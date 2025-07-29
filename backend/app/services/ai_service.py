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
from langchain_pinecone import PineconeEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain_core.documents import Document

import pinecone
from pinecone import Pinecone as PineconeClient
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
                    {"role": "system", "content": "Anda adalah asisten layanan pemerintah Indonesia yang sangat membantu. Berikan informasi yang jelas dan akurat. WAJIB SELALU jawab dalam bahasa Indonesia yang baik dan benar."},
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
    

    async def summarize_and_generate_title(self, conversation: str) -> Dict[str, str]:
        """
        Meringkas percakapan dan menghasilkan judul untuk percakapan tersebut.
        
        Args:
            conversation: Percakapan lengkap yang akan diringkas.
        
        Returns:
            Dict yang berisi summary dan title percakapan.
        """
        try:
            # Prompt untuk ringkasan percakapan
            summary_prompt = f"""
                Ringkas percakapan berikut dalam 2-3 paragraf naratif. Fokus pada topik utama, poin-poin penting, dan kesimpulan. Hindari menggunakan format dialog dan gunakan bahasa Indonesia yang jelas dan mudah dipahami. Paragraf deskriptif harus mencakup informasi yang relevan tanpa mengandung kalimat seperti "terima kasih" atau "maaf" yang tidak berfokus pada layanan.

                Setelah itu, buatkan judul yang mencerminkan topik utama percakapan. Judul harus maksimal 8-10 kata dan menggunakan bahasa Indonesia. Hindari kata-kata umum seperti "ringkasan", "percakapan". Judul harus berfokus pada substansi atau topik yang dibahas dalam percakapan.

                Percakapan:
                {conversation}
            """
            
            # Menggunakan Groq LLM untuk mendapatkan hasil ringkasan dan judul
            response = await self.groq_llm(summary_prompt)
            
            # Menguraikan ringkasan dan title dari response LLM
            summary_data = self.extract_summary_and_title(response)
            
            return summary_data
        
        except Exception as e:
            logger.error(f"Error in summarizing conversation: {e}")
            return {"title": "Tidak ada judul yang tersedia", "summary": "Tidak ada ringkasan yang tersedia"}
    
    def extract_summary_and_title(self, response: str) -> Dict[str, str]:
        """
        Mengambil summary dan title dari hasil response LLM.
        
        Args:
            response: Output dari LLM yang berisi ringkasan dan title.
        
        Returns:
            Dictionary berisi title dan summary percakapan.
        """
        try:
            # Asumsikan format output: "Title: <title>\nSummary: <summary>"
            lines = response.split("\n")
            title = lines[0].replace("Title:", "").strip()
            summary = "\n".join(lines[1:]).replace("Summary:", "").strip()
            return {"title": title, "summary": summary}
        
        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            return {"title": "Judul Tidak Ditemukan", "summary": "Ringkasan Tidak Ditemukan"}


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
            if settings.PINECONE_API_KEY:
                self.embeddings = PineconeEmbeddings(
                    model=settings.EMBEDDING_MODEL,
                    pinecone_api_key=settings.PINECONE_API_KEY
                )
                logger.info(f"Pinecone embeddings ({settings.EMBEDDING_MODEL}) initialized successfully")
            else:
                logger.error("Pinecone API key required for embeddings")
                raise ValueError("PINECONE_API_KEY not found in settings")
            
            # Initialize Pinecone
            if settings.PINECONE_API_KEY:
                try:
                    # Initialize Pinecone
                    pc = PineconeClient(api_key=settings.PINECONE_API_KEY)
                    
                    # Create or connect to index
                    if settings.PINECONE_INDEX_NAME not in pc.list_indexes():
                        pc.create_index(
                            name=settings.PINECONE_INDEX_NAME,
                            dimension=1536,  # multilingual-e5-large embedding dimension
                            metric="cosine",
                            spec=pinecone.ServerlessSpec(cloud="aws", region="us-east-1")
                        )
                        logger.info(f"Created Pinecone index: {settings.PINECONE_INDEX_NAME}")
                    
                    index = pc.Index(settings.PINECONE_INDEX_NAME)
                    self.vectorstore = Pinecone(index, self.embeddings.embed_query, "text")
                    logger.info("Pinecone vector store initialized successfully")
                    
                except Exception as e:
                    logger.error(f"Pinecone initialization failed: {e}")
                    raise
            else:
                logger.error("Pinecone API key required for vector store")
                raise ValueError("PINECONE_API_KEY not found in settings")
            
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
                logger.error("Vector store not available")
                return []
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


# Mock classes removed - use real services only


# Global AI service instance
ai_service = None


def get_ai_service() -> AIService:
    """Get or create AI service instance"""
    global ai_service
    if ai_service is None:
        ai_service = AIService()
    return ai_service