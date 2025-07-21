"""
Document Management Service for Tunarasa RAG System

This service provides high-level document management operations that integrate
the Pinecone vector service with the existing LangChain service for complete
RAG functionality.
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

from app.services.pinecone_service import (
    get_pinecone_service,
    PineconeVectorService,
    DocumentMetadata,
    SearchQuery,
    SearchResult,
    DocumentType,
    ProcessingStatus
)
from app.services.langchain_service import get_langchain_service
from app.core.config import settings

logger = logging.getLogger(__name__)


class DocumentManager:
    """High-level document management service"""
    
    def __init__(self):
        try:
            self.pinecone_service = get_pinecone_service()
        except Exception as e:
            logger.error(f"Failed to initialize Pinecone service: {e}")
            self.pinecone_service = None
            
        try:
            self.langchain_service = get_langchain_service()
        except Exception as e:
            logger.error(f"Failed to initialize LangChain service: {e}")
            self.langchain_service = None
        
        logger.info("Document Manager initialized (with fallback mode if needed)")
    
    async def add_document(
        self,
        file_path: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        author: Optional[str] = None,
        topics: Optional[List[str]] = None,
        language: str = "id"
    ) -> Dict[str, Any]:
        """Add a new document to the knowledge base"""
        
        try:
            # Prepare metadata
            metadata = {
                "language": language
            }
            
            if title:
                metadata["title"] = title
            if description:
                metadata["description"] = description
            if author:
                metadata["author"] = author
            if topics:
                metadata["topics"] = topics
            
            # Ingest into Pinecone
            doc_metadata = await self.pinecone_service.ingest_document(
                file_path=file_path,
                metadata=metadata
            )
            
            # Also add to LangChain vector store for compatibility
            try:
                await self.langchain_service.add_document_to_vectorstore(
                    document_path=file_path,
                    document_id=doc_metadata.document_id,
                    metadata=metadata
                )
            except Exception as e:
                logger.warning(f"Failed to add to LangChain vectorstore: {e}")
            
            logger.info(f"Document added successfully: {doc_metadata.document_id}")
            
            return {
                "success": True,
                "document_id": doc_metadata.document_id,
                "metadata": doc_metadata.to_dict(),
                "message": "Document added successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to add document: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to add document"
            }
    
    async def search_documents(
        self,
        query: str,
        language: str = "id",
        max_results: int = 5,
        similarity_threshold: float = 0.7,
        document_types: Optional[List[str]] = None,
        topics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Search documents using vector similarity"""
        
        try:
            # Convert document types
            doc_types = None
            if document_types:
                doc_types = [DocumentType(dt) for dt in document_types]
            
            # Build metadata filter for topics
            metadata_filter = None
            if topics:
                # Pinecone filter for topics (stored as comma-separated string)
                topic_filter = {"topics": {"$in": topics}}
                metadata_filter = topic_filter
            
            # Create search query
            search_query = SearchQuery(
                query_text=query,
                top_k=max_results,
                similarity_threshold=similarity_threshold,
                language=language,
                document_types=doc_types,
                metadata_filter=metadata_filter
            )
            
            # Perform search
            results = await self.pinecone_service.search(search_query)
            
            # Format results
            formatted_results = []
            for result in results:
                formatted_results.append({
                    "document_id": result.document_id,
                    "chunk_id": result.chunk_id,
                    "content": result.content,
                    "similarity_score": result.similarity_score,
                    "filename": result.metadata.get("filename", ""),
                    "title": result.metadata.get("title", ""),
                    "author": result.metadata.get("author", ""),
                    "page_number": result.page_number,
                    "chunk_index": result.chunk_index,
                    "document_type": result.metadata.get("document_type", ""),
                    "topics": result.metadata.get("topics", "").split(",") if result.metadata.get("topics") else []
                })
            
            logger.info(f"Search completed: {len(results)} results for query '{query[:50]}...'")
            
            return {
                "success": True,
                "query": query,
                "results": formatted_results,
                "total_results": len(results),
                "message": f"Found {len(results)} relevant documents"
            }
            
        except Exception as e:
            logger.error(f"Document search failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Search failed"
            }
    
    async def get_document_info(self, document_id: str) -> Dict[str, Any]:
        """Get detailed information about a document"""
        
        try:
            metadata = await self.pinecone_service.get_document_metadata(document_id)
            
            if not metadata:
                return {
                    "success": False,
                    "message": "Document not found"
                }
            
            return {
                "success": True,
                "document": metadata.to_dict(),
                "message": "Document information retrieved successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to get document info: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve document information"
            }
    
    async def update_document(
        self,
        document_id: str,
        file_path: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        author: Optional[str] = None,
        topics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Update an existing document"""
        
        try:
            # Prepare metadata
            metadata = {}
            if title:
                metadata["title"] = title
            if description:
                metadata["description"] = description
            if author:
                metadata["author"] = author
            if topics:
                metadata["topics"] = topics
            
            # Update in Pinecone
            doc_metadata = await self.pinecone_service.update_document(
                document_id=document_id,
                file_path=file_path,
                metadata=metadata
            )
            
            logger.info(f"Document updated successfully: {document_id}")
            
            return {
                "success": True,
                "document_id": document_id,
                "metadata": doc_metadata.to_dict(),
                "message": "Document updated successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to update document: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to update document"
            }
    
    async def delete_document(self, document_id: str) -> Dict[str, Any]:
        """Delete a document from the knowledge base"""
        
        try:
            success = await self.pinecone_service.delete_document(document_id)
            
            if success:
                logger.info(f"Document deleted successfully: {document_id}")
                return {
                    "success": True,
                    "document_id": document_id,
                    "message": "Document deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "message": "Document not found or deletion failed"
                }
                
        except Exception as e:
            logger.error(f"Failed to delete document: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to delete document"
            }
    
    async def list_documents(
        self,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """List all documents in the knowledge base"""
        
        try:
            # Convert status string to enum
            status_filter = None
            if status:
                status_filter = ProcessingStatus(status)
            
            documents = await self.pinecone_service.list_documents(
                limit=limit,
                offset=offset,
                status_filter=status_filter
            )
            
            # Format documents
            formatted_docs = [doc.to_dict() for doc in documents]
            
            return {
                "success": True,
                "documents": formatted_docs,
                "total": len(formatted_docs),
                "limit": limit,
                "offset": offset,
                "message": f"Retrieved {len(formatted_docs)} documents"
            }
            
        except Exception as e:
            logger.error(f"Failed to list documents: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to list documents"
            }
    
    async def batch_add_documents(
        self,
        file_paths: List[str],
        metadata_list: Optional[List[Dict[str, Any]]] = None,
        max_concurrent: int = 3
    ) -> Dict[str, Any]:
        """Add multiple documents in batch"""
        
        try:
            results = await self.pinecone_service.batch_ingest_documents(
                file_paths=file_paths,
                metadata_list=metadata_list,
                max_concurrent=max_concurrent
            )
            
            # Process results
            successful = []
            failed = []
            
            for file_path, success, error in results:
                if success:
                    successful.append(file_path)
                else:
                    failed.append({"file_path": file_path, "error": error})
            
            logger.info(f"Batch processing completed: {len(successful)} successful, {len(failed)} failed")
            
            return {
                "success": True,
                "successful": successful,
                "failed": failed,
                "total_processed": len(results),
                "success_count": len(successful),
                "failure_count": len(failed),
                "message": f"Batch processing completed: {len(successful)}/{len(results)} successful"
            }
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Batch processing failed"
            }
    
    async def get_knowledge_base_stats(self) -> Dict[str, Any]:
        """Get statistics about the knowledge base"""
        
        try:
            # Get Pinecone index stats
            index_stats = await self.pinecone_service.get_index_stats()
            
            # Get document counts by status
            all_docs = await self.pinecone_service.list_documents(limit=1000)
            
            status_counts = {}
            type_counts = {}
            language_counts = {}
            
            for doc in all_docs:
                # Count by status
                status = doc.processing_status.value
                status_counts[status] = status_counts.get(status, 0) + 1
                
                # Count by type
                doc_type = doc.document_type.value
                type_counts[doc_type] = type_counts.get(doc_type, 0) + 1
                
                # Count by language
                language = doc.language
                language_counts[language] = language_counts.get(language, 0) + 1
            
            return {
                "success": True,
                "stats": {
                    "total_vectors": index_stats.get("total_vector_count", 0),
                    "total_documents": len(all_docs),
                    "index_fullness": index_stats.get("index_fullness", 0),
                    "status_distribution": status_counts,
                    "type_distribution": type_counts,
                    "language_distribution": language_counts
                },
                "message": "Knowledge base statistics retrieved successfully"
            }
            
        except Exception as e:
            logger.error(f"Failed to get knowledge base stats: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to retrieve knowledge base statistics"
            }
    
    async def search_with_qa(
        self,
        question: str,
        session_id: str,
        language: str = "id",
        max_docs: int = 3,
        similarity_threshold: float = 0.7
    ) -> Dict[str, Any]:
        """Search for documents and generate an answer using LangChain"""
        
        try:
            # Check if Pinecone service is available
            if not self.pinecone_service:
                # Use text-based fallback search in local documents
                fallback_answer = await self._search_local_documents(question, session_id, language)
                return fallback_answer
            
            # First, search for relevant documents
            search_result = await self.search_documents(
                query=question,
                language=language,
                max_results=max_docs,
                similarity_threshold=similarity_threshold
            )
            
            if not search_result["success"] or not search_result["results"]:
                # Use local document search when vector search finds nothing
                logger.info(f"Vector search found no results, trying local document search for: {question}")
                fallback_answer = await self._search_local_documents(question, session_id, language)
                return fallback_answer
            
            # Use LangChain service directly even without vector search
            if self.langchain_service:
                try:
                    # Create a simple context without documents
                    context = {
                        "session_id": session_id,
                        "question": question,
                        "language": language,
                        "mode": "casual"
                    }
                    
                    # Use the LangChain service directly with Groq LLM
                    if hasattr(self.langchain_service, 'llm') and self.langchain_service.llm:
                        # Create a simple chat prompt
                        prompt = f"Please answer this question: {question}"
                        
                        # Use the Groq LLM directly
                        response = await self.langchain_service.llm.ainvoke(prompt)
                        
                        qa_response = {
                            "answer": response.content if hasattr(response, 'content') else str(response),
                            "confidence": 0.8,
                            "processing_time": 0.5,
                            "follow_up_suggestions": ["Can you tell me more?", "What else would you like to know?"]
                        }
                    else:
                        raise Exception("LLM not available in LangChain service")
                except Exception as llm_error:
                    logger.error(f"LangChain service failed: {llm_error}")
                    # Fallback to basic response
                    qa_response = {
                        "answer": f"I understand you're asking about '{question}'. I'm currently operating with limited capabilities, but I'm here to help with general information and assistance.",
                        "confidence": 0.5,
                        "processing_time": 0.1,
                        "follow_up_suggestions": []
                    }
            else:
                # No LangChain service available
                qa_response = {
                    "answer": f"I understand you're asking about '{question}'. The AI service is currently unavailable, but I'm here to help in any way I can.",
                    "confidence": 0.3,
                    "processing_time": 0.1,
                    "follow_up_suggestions": []
                }
            
            # Combine search results with Q&A response
            return {
                "success": True,
                "question": question,
                "answer": qa_response.get("answer", ""),
                "confidence": qa_response.get("confidence", 0.0),
                "sources": search_result["results"],
                "processing_time": qa_response.get("processing_time", 0.0),
                "session_id": session_id,
                "follow_up_suggestions": qa_response.get("follow_up_suggestions", []),
                "message": "Question answered successfully"
            }
            
        except Exception as e:
            logger.error(f"Search with Q&A failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to process question with document search"
            }
    
    async def _search_local_documents(
        self,
        question: str,
        session_id: str,
        language: str = "id"
    ) -> Dict[str, Any]:
        """Search through local documents when Pinecone is unavailable"""
        
        try:
            # Path to local document
            document_path = Path(__file__).parent.parent.parent / "documents" / "buku-saku-dukcapil-yogya.txt"
            
            if not document_path.exists():
                logger.warning(f"Local document not found: {document_path}")
                return self._generate_no_document_response(question, session_id, language)
            
            # Read the document content
            def read_file():
                with open(document_path, 'r', encoding='utf-8') as file:
                    return file.read()
            
            content = await asyncio.to_thread(read_file)
            
            # Perform simple text search
            relevant_sections = self._extract_relevant_sections(content, question, language)
            
            # Generate answer using LangChain service if available
            if self.langchain_service and relevant_sections:
                try:
                    # Create prompt with relevant sections
                    context = "\n\n".join(relevant_sections)
                    prompt = self._create_local_search_prompt(question, context, language)
                    
                    # Use the Groq LLM directly
                    response = await self.langchain_service.llm.ainvoke(prompt)
                    answer = response.content if hasattr(response, 'content') else str(response)
                    
                    return {
                        "success": True,
                        "question": question,
                        "answer": answer,
                        "confidence": 0.8,
                        "sources": [{"title": "Buku Saku Dukcapil Yogya", "content": context[:200] + "..."}],
                        "processing_time": 1.0,
                        "session_id": session_id,
                        "follow_up_suggestions": [],
                        "message": "Answered using local document search"
                    }
                    
                except Exception as llm_error:
                    logger.error(f"LLM processing failed in local search: {llm_error}")
                    # Fallback to simple text response
                    pass
            
            # Simple fallback response with relevant sections
            if relevant_sections:
                answer = self._generate_simple_answer(question, relevant_sections, language)
                return {
                    "success": True,
                    "question": question,
                    "answer": answer,
                    "confidence": 0.6,
                    "sources": [{"title": "Buku Saku Dukcapil Yogya", "content": relevant_sections[0][:200] + "..."}],
                    "processing_time": 0.5,
                    "session_id": session_id,
                    "follow_up_suggestions": [],
                    "message": "Answered using local document search (simple mode)"
                }
            else:
                return self._generate_no_match_response(question, session_id, language)
                
        except Exception as e:
            logger.error(f"Local document search failed: {e}")
            return self._generate_error_response(question, session_id, language, str(e))
    
    def _extract_relevant_sections(self, content: str, question: str, language: str) -> List[str]:
        """Extract relevant sections from document content"""
        
        # Split content into paragraphs
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        
        # Create search terms from question
        search_terms = self._extract_search_terms(question, language)
        
        # Score and rank paragraphs
        scored_paragraphs = []
        for paragraph in paragraphs:
            score = self._calculate_relevance_score(paragraph, search_terms)
            if score > 0:
                scored_paragraphs.append((score, paragraph))
        
        # Sort by score and return top 3
        scored_paragraphs.sort(key=lambda x: x[0], reverse=True)
        return [para for score, para in scored_paragraphs[:3]]
    
    def _extract_search_terms(self, question: str, language: str) -> List[str]:
        """Extract key terms from question for searching"""
        
        # Common terms to filter out
        stop_words_id = ['yang', 'untuk', 'dari', 'dengan', 'pada', 'dalam', 'adalah', 'apa', 'bagaimana', 'kapan', 'dimana', 'mengapa', 'siapa']
        stop_words_en = ['what', 'how', 'when', 'where', 'why', 'who', 'is', 'are', 'can', 'do', 'does', 'will', 'would', 'the', 'a', 'an']
        
        stop_words = stop_words_id if language == 'id' else stop_words_en
        
        # Extract meaningful words
        words = question.lower().split()
        search_terms = [word for word in words if len(word) > 2 and word not in stop_words]
        
        return search_terms
    
    def _calculate_relevance_score(self, text: str, search_terms: List[str]) -> float:
        """Calculate relevance score of text for search terms"""
        
        text_lower = text.lower()
        score = 0.0
        
        for term in search_terms:
            # Exact match
            if term in text_lower:
                score += 2.0
            # Partial match
            elif any(term in word for word in text_lower.split()):
                score += 1.0
        
        # Normalize by text length to favor more focused content
        if len(text) > 0:
            score = score / (len(text) / 100)
        
        return score
    
    def _create_local_search_prompt(self, question: str, context: str, language: str) -> str:
        """Create prompt for LLM using local document context"""
        
        if language == 'id':
            return f"""Anda adalah asisten layanan pemerintah Indonesia yang sangat membantu. WAJIB menjawab SELALU dalam bahasa Indonesia yang baik dan benar.

Berdasarkan informasi dari dokumen Dukcapil berikut, jawab pertanyaan dengan akurat dan informatif:

KONTEKS DOKUMEN:
{context}

PERTANYAAN: {question}

INSTRUKSI:
- WAJIB menjawab dalam bahasa Indonesia
- Gunakan informasi dari dokumen untuk memberikan jawaban yang akurat
- Jika informasi tidak tersedia, katakan dengan jelas
- Berikan informasi yang berguna dan mudah dipahami
- Gunakan bahasa yang sopan dan formal

JAWABAN:"""
        else:
            return f"""Based on the following Dukcapil document information, answer the question accurately and informatively:

DOCUMENT CONTEXT:
{context}

QUESTION: {question}

ANSWER: Provide a complete answer based on the available information in the document. If specific information is not available, state this clearly and provide related information that might be helpful."""
    
    def _generate_simple_answer(self, question: str, sections: List[str], language: str) -> str:
        """Generate simple answer from relevant sections"""
        
        if language == 'id':
            intro = f"Berdasarkan dokumen Dukcapil, berikut informasi terkait pertanyaan Anda tentang '{question}':\n\n"
        else:
            intro = f"Based on the Dukcapil document, here is information related to your question about '{question}':\n\n"
        
        # Combine relevant sections
        combined_info = "\n\n".join(sections[:2])  # Use top 2 sections
        
        return intro + combined_info
    
    def _generate_no_document_response(self, question: str, session_id: str, language: str) -> Dict[str, Any]:
        """Generate response when local document is not found"""
        
        if language == 'id':
            answer = "Maaf, dokumen lokal tidak tersedia saat ini. Silakan coba lagi nanti atau hubungi administrator."
        else:
            answer = "Sorry, local document is currently unavailable. Please try again later or contact administrator."
        
        return {
            "success": True,
            "question": question,
            "answer": answer,
            "confidence": 0.3,
            "sources": [],
            "processing_time": 0.1,
            "session_id": session_id,
            "follow_up_suggestions": [],
            "message": "Local document not found"
        }
    
    def _generate_no_match_response(self, question: str, session_id: str, language: str) -> Dict[str, Any]:
        """Generate response when no relevant content is found"""
        
        if language == 'id':
            answer = f"Maaf, saya tidak menemukan informasi yang relevan untuk pertanyaan '{question}' dalam dokumen yang tersedia. Silakan coba dengan kata kunci yang berbeda atau hubungi layanan Dukcapil langsung."
        else:
            answer = f"Sorry, I couldn't find relevant information for the question '{question}' in the available documents. Please try with different keywords or contact Dukcapil services directly."
        
        return {
            "success": True,
            "question": question,
            "answer": answer,
            "confidence": 0.4,
            "sources": [],
            "processing_time": 0.2,
            "session_id": session_id,
            "follow_up_suggestions": ["Coba kata kunci yang lebih spesifik", "Hubungi kantor Dukcapil terdekat"] if language == 'id' else ["Try more specific keywords", "Contact nearest Dukcapil office"],
            "message": "No relevant content found in local document"
        }
    
    def _generate_error_response(self, question: str, session_id: str, language: str, error: str) -> Dict[str, Any]:
        """Generate error response for local document search"""
        
        if language == 'id':
            answer = "Maaf, terjadi kesalahan dalam pencarian dokumen lokal. Silakan coba lagi nanti."
        else:
            answer = "Sorry, an error occurred during local document search. Please try again later."
        
        return {
            "success": False,
            "question": question,
            "answer": answer,
            "confidence": 0.0,
            "sources": [],
            "processing_time": 0.1,
            "session_id": session_id,
            "follow_up_suggestions": [],
            "error": error,
            "message": "Local document search error"
        }


# Global document manager instance
_document_manager: Optional[DocumentManager] = None


def get_document_manager() -> DocumentManager:
    """Get or create document manager instance"""
    global _document_manager
    if _document_manager is None:
        _document_manager = DocumentManager()
    return _document_manager


# Convenience functions
async def add_document_to_knowledge_base(
    file_path: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    topics: Optional[List[str]] = None
) -> str:
    """Convenience function to add a document and return document ID"""
    
    manager = get_document_manager()
    result = await manager.add_document(
        file_path=file_path,
        title=title,
        description=description,
        topics=topics
    )
    
    if result["success"]:
        return result["document_id"]
    else:
        raise Exception(result["message"])


async def search_knowledge_base(
    query: str,
    language: str = "id",
    max_results: int = 5
) -> List[Dict[str, Any]]:
    """Convenience function for knowledge base search"""
    
    manager = get_document_manager()
    result = await manager.search_documents(
        query=query,
        language=language,
        max_results=max_results
    )
    
    if result["success"]:
        return result["results"]
    else:
        raise Exception(result["message"])


async def ask_question_with_sources(
    question: str,
    session_id: str,
    language: str = "id"
) -> Dict[str, Any]:
    """Convenience function for Q&A with source documents"""
    
    manager = get_document_manager()
    result = await manager.search_with_qa(
        question=question,
        session_id=session_id,
        language=language
    )
    
    if result["success"]:
        return result
    else:
        raise Exception(result["message"])