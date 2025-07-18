"""
AI Service for LangChain + ChatGroq + Pinecone RAG Integration
"""

import logging
import os
from typing import List, Dict, Any, Optional
import asyncio
from datetime import datetime
import json

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.vectorstores import Pinecone
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain_core.documents import Document

import pinecone
from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)


class GroqLLM:
    """Custom LangChain-compatible Groq LLM wrapper"""
    
    def __init__(self, api_key: str, model_name: str = "llama3-8b-8192"):
        self.client = Groq(api_key=api_key)
        self.model_name = model_name
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS
    
    def __call__(self, prompt: str) -> str:
        """Call the Groq API with the given prompt"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant for Indonesian government services. Provide clear, accurate information in Indonesian or English as requested."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            return "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi."


class AIService:
    """Main AI service for RAG-based question answering"""
    
    def __init__(self):
        self.groq_llm = None
        self.embeddings = None
        self.vectorstore = None
        self.qa_chain = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        self.redis_client = None
        
        # Initialize services
        self._initialize_services()
    
    def _initialize_services(self):
        """Initialize AI services"""
        try:
            # Initialize Groq LLM
            if settings.GROQ_API_KEY:
                self.groq_llm = GroqLLM(
                    api_key=settings.GROQ_API_KEY,
                    model_name=settings.LLM_MODEL
                )
                logger.info("Groq LLM initialized successfully")
            
            # Initialize embeddings
            if settings.OPENAI_API_KEY:
                self.embeddings = OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)
                logger.info("OpenAI embeddings initialized successfully")
            else:
                # Use mock embeddings for development
                self.embeddings = MockEmbeddings()
                logger.warning("Using mock embeddings - OpenAI API key not found")
            
            # Initialize Pinecone
            if settings.PINECONE_API_KEY:
                try:
                    pinecone.init(
                        api_key=settings.PINECONE_API_KEY,
                        environment=settings.PINECONE_ENVIRONMENT
                    )
                    
                    # Create index if it doesn't exist
                    if settings.PINECONE_INDEX_NAME not in pinecone.list_indexes():
                        pinecone.create_index(
                            name=settings.PINECONE_INDEX_NAME,
                            dimension=1536,  # OpenAI embedding dimension
                            metric="cosine"
                        )
                    
                    index = pinecone.Index(settings.PINECONE_INDEX_NAME)
                    self.vectorstore = Pinecone(index, self.embeddings.embed_query, "text")
                    logger.info("Pinecone vector store initialized successfully")
                    
                except Exception as e:
                    logger.error(f"Pinecone initialization failed: {e}")
                    # Use mock vector store for development
                    self.vectorstore = MockVectorStore()
            else:
                logger.warning("Pinecone API key not found, using mock vector store")
                self.vectorstore = MockVectorStore()
            
            # Initialize Redis for caching
            try:
                import redis
                self.redis_client = redis.from_url(settings.REDIS_URL)
                self.redis_client.ping()
                logger.info("Redis connected for AI service caching")
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
            
            logger.info("AI Service initialized successfully")
            
        except Exception as e:
            logger.error(f"AI Service initialization failed: {e}")
            raise
    
    async def process_question(
        self,
        question: str,
        session_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process a question using RAG pipeline"""
        
        start_time = datetime.utcnow()
        
        try:
            # Check cache first
            cache_key = f"question:{hash(question)}"
            cached_response = await self._get_cached_response(cache_key)
            if cached_response:
                logger.info(f"Returning cached response for question: {question[:50]}...")
                return cached_response
            
            # Step 1: Retrieve relevant documents
            relevant_docs = await self._retrieve_documents(question)
            
            # Step 2: Build context from retrieved documents
            context_text = self._build_context(relevant_docs)
            
            # Step 3: Generate response using Groq LLM
            response = await self._generate_response(question, context_text)
            
            # Step 4: Build final response
            processing_time = (datetime.utcnow() - start_time).total_seconds()
            
            result = {
                "question": question,
                "answer": response,
                "context_used": context_text[:500] + "..." if len(context_text) > 500 else context_text,
                "source_documents": [doc.metadata for doc in relevant_docs],
                "processing_time": processing_time,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
                "model_used": "groq-llama3-8b-8192"
            }
            
            # Cache the response
            await self._cache_response(cache_key, result)
            
            logger.info(f"Question processed successfully in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Question processing failed: {e}")
            
            # Return error response
            return {
                "question": question,
                "answer": "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi nanti.",
                "error": str(e),
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
                "processing_time": (datetime.utcnow() - start_time).total_seconds()
            }
    
    async def _retrieve_documents(self, query: str, k: int = None) -> List[Document]:
        """Retrieve relevant documents from vector store"""
        
        try:
            if k is None:
                k = settings.RAG_RETRIEVAL_K
                
            if self.vectorstore and hasattr(self.vectorstore, 'similarity_search'):
                docs = self.vectorstore.similarity_search(query, k=k)
                return docs
            else:
                # Mock documents for development
                return [
                    Document(
                        page_content=f"Sample document content related to: {query}",
                        metadata={
                            "source": "sample_document.pdf",
                            "page": 1,
                            "document_id": "doc_sample_1"
                        }
                    )
                ]
        except Exception as e:
            logger.error(f"Document retrieval failed: {e}")
            return []
    
    def _build_context(self, documents: List[Document]) -> str:
        """Build context from retrieved documents"""
        
        if not documents:
            return "Tidak ada dokumen yang relevan ditemukan."
        
        context_parts = []
        for doc in documents:
            context_parts.append(f"Dokumen: {doc.metadata.get('source', 'Unknown')}")
            context_parts.append(f"Konten: {doc.page_content}")
            context_parts.append("---")
        
        return "\n".join(context_parts)
    
    async def _generate_response(self, question: str, context: str) -> str:
        """Generate response using Groq LLM"""
        
        try:
            prompt = f"""
Berdasarkan konteks dokumen berikut, jawab pertanyaan dengan akurat dan jelas:

KONTEKS:
{context}

PERTANYAAN: {question}

JAWABAN:
Berikan jawaban yang lengkap dan informatif dalam bahasa Indonesia. Jika informasi tidak tersedia dalam konteks, katakan dengan jelas bahwa informasi tersebut tidak tersedia.
"""
            
            if self.groq_llm:
                response = self.groq_llm(prompt)
                return response
            else:
                return "Layanan AI sedang tidak tersedia. Silakan coba lagi nanti."
                
        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            return "Maaf, terjadi kesalahan dalam menghasilkan jawaban. Silakan coba lagi."
    
    async def _get_cached_response(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached response from Redis"""
        
        if not self.redis_client:
            return None
        
        try:
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Cache retrieval failed: {e}")
        
        return None
    
    async def _cache_response(self, cache_key: str, response: Dict[str, Any]):
        """Cache response in Redis"""
        
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.setex(
                cache_key,
                3600,  # 1 hour cache
                json.dumps(response, default=str)
            )
        except Exception as e:
            logger.error(f"Cache storage failed: {e}")
    
    async def add_document_to_vectorstore(self, document_path: str, document_id: str) -> bool:
        """Add document to vector store"""
        
        try:
            # Load document
            if document_path.endswith('.pdf'):
                loader = PyPDFLoader(document_path)
            else:
                loader = TextLoader(document_path)
            
            documents = loader.load()
            
            # Split documents into chunks
            chunks = self.text_splitter.split_documents(documents)
            
            # Add metadata
            for chunk in chunks:
                chunk.metadata.update({
                    "document_id": document_id,
                    "processed_at": datetime.utcnow().isoformat()
                })
            
            # Add to vector store
            if self.vectorstore and hasattr(self.vectorstore, 'add_documents'):
                self.vectorstore.add_documents(chunks)
            
            logger.info(f"Document {document_id} added to vector store with {len(chunks)} chunks")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add document to vector store: {e}")
            return False


class MockEmbeddings:
    """Mock embeddings for development"""
    
    def embed_query(self, text: str) -> List[float]:
        """Return mock embedding"""
        import random
        return [random.random() for _ in range(1536)]
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Return mock embeddings for documents"""
        return [self.embed_query(text) for text in texts]


class MockVectorStore:
    """Mock vector store for development"""
    
    def __init__(self):
        self.documents = []
    
    def similarity_search(self, query: str, k: int = 3) -> List[Document]:
        """Return mock similar documents"""
        return [
            Document(
                page_content=f"Mock content related to: {query}. This is sample government service information.",
                metadata={
                    "source": "mock_document.pdf",
                    "page": 1,
                    "document_id": "mock_doc_1"
                }
            )
        ]
    
    def add_documents(self, documents: List[Document]):
        """Add documents to mock store"""
        self.documents.extend(documents)


# Global AI service instance
ai_service = None


def get_ai_service() -> AIService:
    """Get or create AI service instance"""
    global ai_service
    if ai_service is None:
        ai_service = AIService()
    return ai_service