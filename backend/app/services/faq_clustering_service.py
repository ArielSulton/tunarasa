import re
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import pinecone
from pinecone import Pinecone, ServerlessSpec
import logging
import warnings
from app.core.config import settings
from pinecone import Pinecone as PineconeClient
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

class PineconeEmbeddings:
    """Custom Pinecone Embeddings wrapper"""
    def __init__(self, model: str, pinecone_api_key: str):
        self.model = model
        self.pinecone_api_key = pinecone_api_key
        # Initialize embedding model through Pinecone's inference API
        self.pc = Pinecone(api_key=pinecone_api_key)
    
    def embed_query(self, text: str) -> List[float]:
        """Embed a single query text"""
        return self.embed_documents([text])[0]
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple documents using Pinecone's inference API"""
        try:
            print("Texts to embed:", texts)
            response = self.pc.inference.embed(
                model=self.model,
                inputs=texts,
                parameters={"input_type": "query"}
            )
            print("Embedding response:", response)
            return [embedding['values'] for embedding in response.data]
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise

class SimplifiedFAQClusteringService:
    def __init__(self, 
                 pinecone_api_key: str, 
                 pinecone_index_name: str, 
                 embedding_model: str = 'multilingual-e5-large'):
        self.pinecone_api_key = pinecone_api_key
        self.pinecone_index_name = pinecone_index_name
        self.embedding_model = embedding_model
        
        # Initialize embeddings and vector store  ping api.pinecone.io
        self.embeddings = None
        self.vectorstore = None
        self.index = None
        
        self._initialize_embeddings()
        self._initialize_vectorstore()

    def _initialize_embeddings(self):
        """Initialize embeddings service"""
        try:
            if settings.PINECONE_API_KEY:
                self.embeddings = PineconeEmbeddings(
                    model=settings.EMBEDDING_MODEL,
                    pinecone_api_key=settings.PINECONE_API_KEY
                )
                logger.info(f"Pinecone embeddings ({settings.EMBEDDING_MODEL}) initialized successfully")
            else:
                logger.error("Pinecone API key required for embeddings")
                raise ValueError("PINECONE_API_KEY not found in settings")
                
        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            logger.warning("Continuing without embeddings - vector search disabled")
            self.embeddings = None
    
    def _initialize_vectorstore(self):
        """Initialize Pinecone vector store"""
        try:
            if settings.PINECONE_API_KEY and self.embeddings:
                # Initialize Pinecone
                pc = PineconeClient(api_key=settings.PINECONE_API_KEY)

                # Create or connect to index
                if settings.PINECONE_INDEX_NAME not in pc.list_indexes():
                    pc.create_index(
                        name=settings.PINECONE_INDEX_NAME,
                        dimension=1536,  # multilingual-e5-large embedding dimension
                        metric="cosine",
                        spec=pinecone.ServerlessSpec(cloud="aws", region="us-east-1"),
                    )
                    logger.info(
                        f"Created Pinecone index: {settings.PINECONE_INDEX_NAME}"
                    )

                index = pc.Index(settings.PINECONE_INDEX_NAME)
                self.vectorstore = Pinecone(index, self.embeddings.embed_query, "text")

                logger.info("Pinecone vector store initialized successfully")

            else:
                logger.warning(
                    "Pinecone API key or embeddings not available for vector store"
                )
                self.vectorstore = None
                
        except Exception as e:
            logger.error(f"Failed to initialize vector store: {e}")
            logger.warning("Continuing without vector store - document search disabled")
            self.vectorstore = None
    
    def _initialize_retriever(self):
        """Initialize enhanced retriever with compression"""
        try:
            if self.vectorstore and self.llm:
                # Base retriever
                base_retriever = self.vectorstore.as_retriever(
                    search_type="similarity",
                    search_kwargs={"k": settings.RAG_RETRIEVAL_K}
                )
                
                # Multi-query retriever for better coverage
                multi_query_retriever = MultiQueryRetriever.from_llm(
                    retriever=base_retriever,
                    llm=self.llm
                )
                
                # Compression retriever for relevance filtering
                compressor = LLMChainExtractor.from_llm(self.llm)
                self.retriever = ContextualCompressionRetriever(
                    base_compressor=compressor,
                    base_retriever=multi_query_retriever
                )
                
                logger.info("Enhanced retriever initialized with compression")
                
            else:
                logger.warning("Vector store not available - operating without document retrieval")
                self.retriever = None
                
        except Exception as e:
            logger.error(f"Failed to initialize retriever: {e}")
            logger.warning("Continuing without retriever - direct LLM responses only")
            self.retriever = None

    def simple_preprocess_text(self, text: str) -> str:
        """Simple preprocessing - minimal cleaning only"""
        # Minimal cleaning - preserve semantic meaning
        text = text.strip()
        # Only remove excessive whitespace and normalize
        text = re.sub(r'\s+', ' ', text)
        # Optional: remove only non-alphanumeric except spaces and common punctuation
        text = re.sub(r'[^\w\s\?\!\.]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text

    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings using Pinecone's embedding service"""
        if not self.embeddings:
            raise ValueError("Embeddings service not initialized")
        
        # Simple preprocessing
        processed_texts = [self.simple_preprocess_text(text) for text in texts]
        
        # Generate embeddings through Pinecone
        embeddings = self.embeddings.embed_documents(processed_texts)
        print("masuk dulu cuy \n"*10)

        
        logger.info(f"Generated embeddings for {len(texts)} texts")
        return np.array(embeddings)

    def find_optimal_k(self, embeddings: np.ndarray, max_k: int = 10) -> int:
        """Find optimal number of clusters using silhouette score"""
        n_samples = len(embeddings)
        max_k = min(max_k, n_samples // 2)
        
        if max_k < 2:
            return 2
            
        silhouette_scores = []
        k_range = range(2, max_k + 1)
        
        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(embeddings)
            sil_score = silhouette_score(embeddings, cluster_labels)
            silhouette_scores.append(sil_score)
        
        optimal_idx = np.argmax(silhouette_scores)
        optimal_k = list(k_range)[optimal_idx]
        
        logger.info(f"Optimal number of clusters: {optimal_k}")
        return optimal_k

    def cluster_questions(self, questions: List[str]) -> Dict[str, Any]:
        """Main clustering function using Pinecone embeddings"""
        logger.info(f"Starting clustering process for {len(questions)} questions")
        print("mulai \n"*10)
        print(questions)
        
        try:
            # Generate embeddings using Pinecone
            embeddings = self.generate_embeddings(questions)
            print("sudah embedding \n"*10)

            # Find optimal number of clusters
            optimal_k = self.find_optimal_k(embeddings)
            print("optimal k \n"*10)

            # Perform clustering
            kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(embeddings)
            print("sudah clustering \n"*10)
            
            # Get representative questions
            representatives = self.get_representative_questions(
                questions, embeddings, clusters, kmeans
            )
            
            # Get cluster keywords using simple frequency analysis
            keywords = self.get_cluster_keywords(questions, clusters, optimal_k)
            
            result = {
                "n_clusters": optimal_k,
                "clusters": clusters.tolist(),
                "representatives": representatives,
                "keywords": keywords
            }
            
            logger.info("Clustering process completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error in clustering process: {e}")
            # Return a default response structure to prevent 500 errors
            return {
                "n_clusters": 1,
                "clusters": [0] * len(questions),
                "representatives": {
                    0: {
                        'representative': questions[0] if questions else "",
                        'representative_index': 0,
                        'all_questions': questions,
                        'count': len(questions),
                        'avg_similarity': 0.0,
                        'centroid_distance': 0.0
                    }
                },
                "keywords": {0: []},
                "error": str(e)
            }

    def get_representative_questions(self, 
                                    questions: List[str], 
                                    embeddings: np.ndarray, 
                                    clusters: np.ndarray, 
                                    kmeans) -> Dict[int, Dict[str, Any]]:
        """Get representative questions for each cluster"""
        representatives = {}

        for cluster_id in range(kmeans.n_clusters):
            cluster_mask = clusters == cluster_id
            cluster_questions = [q for i, q in enumerate(questions) if cluster_mask[i]]
            cluster_embeddings = embeddings[cluster_mask]
            cluster_indices = [i for i, mask in enumerate(cluster_mask) if mask]
            
            if len(cluster_questions) == 0:
                continue
            
            # Find question closest to centroid
            centroid = kmeans.cluster_centers_[cluster_id]
            distances = np.linalg.norm(cluster_embeddings - centroid, axis=1)
            best_idx = np.argmin(distances)
            
            representative = cluster_questions[best_idx]
            representative_index = cluster_indices[best_idx]
            
            # Calculate average similarity within cluster
            cluster_similarities = []
            for i, emb1 in enumerate(cluster_embeddings):
                for j, emb2 in enumerate(cluster_embeddings):
                    if i != j:
                        sim = np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
                        cluster_similarities.append(sim)
            
            avg_similarity = float(np.mean(cluster_similarities)) if cluster_similarities else 0
            
            representatives[cluster_id] = {
                'representative': representative,
                'representative_index': representative_index,
                'all_questions': cluster_questions,
                'count': len(cluster_questions),
                'avg_similarity': avg_similarity,
                'centroid_distance': float(distances[best_idx])
            }
            
            logger.info(f"Cluster {cluster_id}: {len(cluster_questions)} questions, "
                    f"avg similarity: {avg_similarity:.3f}")
        
        return representatives


    def get_cluster_keywords(self, 
                            questions: List[str], 
                            clusters: np.ndarray, 
                            n_clusters: int) -> Dict[int, List[str]]:
        """Extract keywords using embeddings similarity instead of frequency"""
        keywords = {}
        
        for cluster_id in range(n_clusters):
            cluster_mask = clusters == cluster_id
            cluster_questions = [q for i, q in enumerate(questions) if cluster_mask[i]]
            
            if len(cluster_questions) == 0:
                keywords[cluster_id] = []
                continue
            
            # Use the representative question as basis for keywords
            if cluster_questions:
                # Simple approach: extract meaningful words from representative question
                representative = cluster_questions[0]  # or use the actual representative
                processed = self.simple_preprocess_text(representative)
                
                # Extract potential keywords (more than 3 characters)
                words = [word for word in processed.split() if len(word) > 3]
                keywords[cluster_id] = words[:5]  # Take first 5 meaningful words
            else:
                keywords[cluster_id] = []
                
        logger.info("Keywords extraction completed for all clusters")
        return keywords

    def search_similar_questions(self, 
                                query: str, 
                                similarity_threshold: float = 0.7,
                                max_results: int = 100,
                                min_results: int = 1) -> List[Dict[str, Any]]:
        """
        Search for similar questions using dynamic similarity threshold
        
        Args:
            query: Search query
            similarity_threshold: Minimum similarity score (0.0 to 1.0)
            max_results: Maximum number of results to fetch initially
            min_results: Minimum number of results to return (fallback)
        
        Returns:
            List of similar questions above threshold
        """
        if not self.index:
            logger.warning("Vector store not available")
            return []
        
        try:
            # Generate query embedding
            query_embedding = self.embeddings.embed_query(self.simple_preprocess_text(query))
            
            # Search in Pinecone with max_results to filter later
            results = self.index.query(
                vector=query_embedding,
                top_k=max_results,
                include_metadata=True
            )
            
            # Filter results by similarity threshold
            filtered_results = []
            for match in results['matches']:
                if match['score'] >= similarity_threshold:
                    filtered_results.append({
                        'id': match['id'],
                        'score': match['score'],
                        'metadata': match.get('metadata', {}),
                        'similarity_percentage': round(match['score'] * 100, 2)
                    })
            
            # If no results meet threshold, return top min_results with warning
            if len(filtered_results) == 0 and min_results > 0:
                logger.warning(f"No results above threshold {similarity_threshold}, returning top {min_results}")
                for i, match in enumerate(results['matches'][:min_results]):
                    filtered_results.append({
                        'id': match['id'],
                        'score': match['score'],
                        'metadata': match.get('metadata', {}),
                        'similarity_percentage': round(match['score'] * 100, 2),
                        'below_threshold': True
                    })
            
            logger.info(f"Found {len(filtered_results)} results above threshold {similarity_threshold}")
            return filtered_results
            
        except Exception as e:
            logger.error(f"Error searching similar questions: {e}")
            return []

    def search_with_adaptive_threshold(self, 
                                     query: str,
                                     target_count: int = 5,
                                     max_threshold: float = 0.9,
                                     min_threshold: float = 0.5,
                                     step: float = 0.05) -> List[Dict[str, Any]]:
        """
        Adaptive search that adjusts threshold to get approximately target_count results
        
        Args:
            query: Search query
            target_count: Target number of results
            max_threshold: Starting (highest) threshold
            min_threshold: Minimum threshold to try
            step: Step size for threshold reduction
        
        Returns:
            List of similar questions with adaptive threshold
        """
        current_threshold = max_threshold
        
        while current_threshold >= min_threshold:
            results = self.search_similar_questions(
                query=query,
                similarity_threshold=current_threshold,
                max_results=100,
                min_results=0
            )
            
            # If we have enough results, return them
            if len(results) >= target_count:
                logger.info(f"Found {len(results)} results with threshold {current_threshold}")
                return results[:target_count]  # Return exactly target_count
            
            # If we have some results but not enough, and we're at min_threshold
            if len(results) > 0 and current_threshold <= min_threshold:
                logger.info(f"Returning {len(results)} results at minimum threshold {min_threshold}")
                return results
            
            # Reduce threshold and try again
            current_threshold -= step
            current_threshold = round(current_threshold, 2)
        
        # Fallback: return best matches regardless of threshold
        logger.warning(f"Could not find {target_count} results above {min_threshold}, returning best matches")
        return self.search_similar_questions(
            query=query,
            similarity_threshold=0.0,  # No threshold
            max_results=target_count,
            min_results=target_count
        )

    def get_similarity_statistics(self, query: str, max_samples: int = 50) -> Dict[str, float]:
        """
        Get similarity statistics to help determine appropriate thresholds
        
        Args:
            query: Search query
            max_samples: Number of samples to analyze
            
        Returns:
            Dictionary with similarity statistics
        """
        if not self.index:
            return {}
        
        try:
            query_embedding = self.embeddings.embed_query(self.simple_preprocess_text(query))
            results = self.index.query(
                vector=query_embedding,
                top_k=max_samples,
                include_metadata=True
            )
            
            scores = [match['score'] for match in results['matches']]
            
            if not scores:
                return {}
            
            stats = {
                'max_score': float(np.max(scores)),
                'min_score': float(np.min(scores)),
                'mean_score': float(np.mean(scores)),
                'median_score': float(np.median(scores)),
                'std_score': float(np.std(scores)),
                'q75_score': float(np.percentile(scores, 75)),
                'q25_score': float(np.percentile(scores, 25)),
                'total_samples': len(scores)
            }
            
            # Suggest thresholds based on statistics
            stats['suggested_high_threshold'] = round(stats['q75_score'], 2)
            stats['suggested_medium_threshold'] = round(stats['median_score'], 2)
            stats['suggested_low_threshold'] = round(stats['q25_score'], 2)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting similarity statistics: {e}")
            return {}

    def search_with_confidence_levels(self, 
                                    query: str,
                                    max_results: int = 50) -> Dict[str, List[Dict[str, Any]]]:
        """
        Search and categorize results by confidence levels
        
        Returns:
            Dictionary with results categorized by confidence (high, medium, low)
        """
        # Get similarity statistics first
        stats = self.get_similarity_statistics(query, max_results)
        
        if not stats:
            return {'high': [], 'medium': [], 'low': []}
        
        # Define thresholds based on statistics
        high_threshold = stats.get('suggested_high_threshold', 0.8)
        medium_threshold = stats.get('suggested_medium_threshold', 0.6)
        low_threshold = stats.get('suggested_low_threshold', 0.4)
        
        # Get all results
        all_results = self.search_similar_questions(
            query=query,
            similarity_threshold=0.0,
            max_results=max_results,
            min_results=0
        )
        
        # Categorize results
        categorized = {
            'high': [],
            'medium': [],
            'low': [],
            'statistics': stats,
            'thresholds': {
                'high': high_threshold,
                'medium': medium_threshold,
                'low': low_threshold
            }
        }
        
        for result in all_results:
            score = result['score']
            result['confidence_level'] = (
                'high' if score >= high_threshold else
                'medium' if score >= medium_threshold else
                'low' if score >= low_threshold else
                'very_low'
            )
            
            if score >= high_threshold:
                categorized['high'].append(result)
            elif score >= medium_threshold:
                categorized['medium'].append(result)
            elif score >= low_threshold:
                categorized['low'].append(result)
        
    def store_questions_in_vectorstore(self, 
                                     questions: List[str], 
                                     metadata: Optional[List[Dict]] = None):
        """Store questions in Pinecone vector store for future similarity search"""
        if not self.index:
            logger.warning("Vector store not available")
            return
        
        try:
            # Generate embeddings
            embeddings = self.generate_embeddings(questions)
            
            # Prepare vectors for upsert
            vectors = []
            for i, (question, embedding) in enumerate(zip(questions, embeddings)):
                vector_id = f"question_{i}"
                vector_metadata = {
                    'question': question,
                    'processed_question': self.simple_preprocess_text(question)
                }
                
                if metadata and i < len(metadata):
                    vector_metadata.update(metadata[i])
                
                vectors.append({
                    'id': vector_id,
                    'values': embedding.tolist(),
                    'metadata': vector_metadata
                })
            
            # Upsert to Pinecone
            self.index.upsert(vectors=vectors)
            logger.info(f"Stored {len(questions)} questions in vector store")
            
        except Exception as e:
            logger.error(f"Error storing questions in vector store: {e}")


