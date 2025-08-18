"""
Enhanced LangChain Service with ChatGroq Integration for Tunarasa
Provides comprehensive question answering with RAG capabilities, conversation memory, and advanced features.
"""

import asyncio
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import pinecone
import redis
from app.core.config import settings
from app.core.database import get_db_session
from app.db.models import Institution
from langchain.callbacks.base import BaseCallbackHandler
from langchain.memory import (
    ConversationBufferWindowMemory,
    ConversationSummaryBufferMemory,
)
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain.schema import BaseMemory
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)
from langchain_groq import ChatGroq
from langchain_pinecone import PineconeEmbeddings, PineconeVectorStore
from pinecone import Pinecone as PineconeClient
from sqlalchemy import select

logger = logging.getLogger(__name__)


class ConversationMode(Enum):
    """Conversation modes for different interaction patterns"""

    CASUAL = "casual"
    FORMAL = "formal"
    TECHNICAL = "technical"
    EDUCATIONAL = "educational"


class ResponseQuality(Enum):
    """Response quality levels"""

    BASIC = "basic"
    DETAILED = "detailed"
    COMPREHENSIVE = "comprehensive"


@dataclass
class ConversationContext:
    """Enhanced conversation context with metadata"""

    session_id: str
    user_id: Optional[str] = None
    conversation_mode: ConversationMode = ConversationMode.CASUAL
    response_quality: ResponseQuality = ResponseQuality.DETAILED
    language: str = "en"
    topic_focus: Optional[str] = None
    max_history: int = 10
    created_at: datetime = None
    updated_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)
        if self.updated_at is None:
            self.updated_at = datetime.now(timezone.utc)


@dataclass
class EnhancedResponse:
    """Enhanced response with comprehensive metadata"""

    answer: str
    confidence: float
    reasoning: str
    sources: List[Dict[str, Any]]
    conversation_id: str
    session_id: str
    processing_time: float
    model_used: str
    retrieval_quality: float
    context_used: str
    follow_up_suggestions: List[str]
    related_topics: List[str]
    timestamp: datetime
    language: str
    conversation_mode: ConversationMode
    response_quality: ResponseQuality
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result["timestamp"] = self.timestamp.isoformat()
        result["conversation_mode"] = self.conversation_mode.value
        result["response_quality"] = self.response_quality.value
        return result


class MetricsCallback(BaseCallbackHandler):
    """Custom callback for tracking LLM metrics"""

    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.token_usage = {}

    def on_llm_start(
        self, serialized: Dict[str, Any], prompts: List[str], **kwargs
    ) -> None:
        """Called when LLM starts running"""
        self.start_time = datetime.now(timezone.utc)
        logger.debug(f"LLM started processing {len(prompts)} prompts")

    def on_llm_end(self, response, **kwargs) -> None:
        """Called when LLM ends running"""
        self.end_time = datetime.now(timezone.utc)
        if hasattr(response, "llm_output") and response.llm_output:
            self.token_usage = response.llm_output.get("token_usage", {})
        logger.debug(f"LLM completed in {self.get_duration():.2f}s")

    def get_duration(self) -> float:
        """Get processing duration in seconds"""
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0


class EnhancedLangChainService:
    """Enhanced LangChain service with comprehensive RAG and conversation capabilities"""

    def __init__(self):
        self.llm = None
        self.embeddings = None
        self.vectorstore = None
        self.retriever = None
        self.conversation_memory = {}
        self.redis_client = None
        self.text_splitter = None
        self.conversation_contexts = {}

        # Initialize components
        self._initialize_llm()
        self._initialize_embeddings()
        self._initialize_vectorstore()
        self._initialize_retriever()
        self._initialize_redis()
        self._initialize_text_splitter()

        # Prompt templates
        self._initialize_prompts()

        logger.info("Enhanced LangChain service initialized successfully")

    def _initialize_llm(self):
        """Initialize ChatGroq LLM with enhanced configuration"""
        try:
            if not settings.GROQ_API_KEY:
                raise ValueError("GROQ_API_KEY not found in settings")

            self.llm = ChatGroq(
                groq_api_key=settings.GROQ_API_KEY,
                model_name=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                timeout=30,
                max_retries=3,
                streaming=False,
            )

            logger.info(f"ChatGroq LLM initialized with model: {settings.LLM_MODEL}")

        except Exception as e:
            logger.error(f"Failed to initialize ChatGroq LLM: {e}")
            raise

    def _initialize_embeddings(self):
        """Initialize embeddings service"""
        try:
            if settings.PINECONE_API_KEY:
                self.embeddings = PineconeEmbeddings(
                    model=settings.EMBEDDING_MODEL,
                    pinecone_api_key=settings.PINECONE_API_KEY,
                )
                logger.info(
                    f"Pinecone embeddings ({settings.EMBEDDING_MODEL}) initialized successfully"
                )
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
                existing_indexes = [idx.name for idx in pc.list_indexes()]
                if settings.PINECONE_INDEX_NAME not in existing_indexes:
                    try:
                        pc.create_index(
                            name=settings.PINECONE_INDEX_NAME,
                            dimension=1536,  # multilingual-e5-large embedding dimension
                            metric="cosine",
                            spec=pinecone.ServerlessSpec(
                                cloud="aws", region="us-east-1"
                            ),
                        )
                        logger.info(
                            f"Created Pinecone index: {settings.PINECONE_INDEX_NAME}"
                        )
                    except Exception as create_error:
                        # Check if error is due to index already existing
                        if "already exists" in str(
                            create_error
                        ).lower() or "ALREADY_EXISTS" in str(create_error):
                            logger.info(
                                f"Pinecone index '{settings.PINECONE_INDEX_NAME}' already exists, continuing..."
                            )
                        else:
                            # Re-raise if it's a different error
                            raise create_error

                self.vectorstore = PineconeVectorStore.from_existing_index(
                    index_name=settings.PINECONE_INDEX_NAME, embedding=self.embeddings
                )

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
                    search_kwargs={"k": settings.RAG_RETRIEVAL_K},
                )

                # Multi-query retriever for better coverage
                multi_query_retriever = MultiQueryRetriever.from_llm(
                    retriever=base_retriever, llm=self.llm
                )

                # Compression retriever for relevance filtering
                compressor = LLMChainExtractor.from_llm(self.llm)
                self.retriever = ContextualCompressionRetriever(
                    base_compressor=compressor, base_retriever=multi_query_retriever
                )

                logger.info("Enhanced retriever initialized with compression")

            else:
                logger.warning(
                    "Vector store not available - operating without document retrieval"
                )
                self.retriever = None

        except Exception as e:
            logger.error(f"Failed to initialize retriever: {e}")
            logger.warning("Continuing without retriever - direct LLM responses only")
            self.retriever = None

    def _initialize_redis(self):
        """Initialize Redis for conversation caching"""
        try:
            self.redis_client = redis.from_url(settings.REDIS_URL)
            self.redis_client.ping()
            logger.info("Redis connected for conversation caching")

        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            self.redis_client = None

    def _initialize_text_splitter(self):
        """Initialize text splitter for document processing"""
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _initialize_prompts(self):
        """Initialize prompt templates for different conversation modes"""

        # System prompts for different modes
        self.system_prompts = {
            ConversationMode.CASUAL: """Anda adalah asisten layanan pemerintah Indonesia yang ramah dan membantu.
            Berikan informasi yang jelas dan akurat dengan cara yang mudah dipahami. Gunakan bahasa sederhana dan tunjukkan empati terhadap kebutuhan pengguna.
            WAJIB SELALU jawab dalam bahasa Indonesia yang baik dan benar.""",
            ConversationMode.FORMAL: """Anda adalah asisten layanan pemerintah profesional.
            Berikan informasi yang formal, akurat, dan komprehensif tentang layanan pemerintah Indonesia.
            Gunakan terminologi yang tepat dan pertahankan nada profesional sepanjang interaksi.
            WAJIB SELALU jawab dalam bahasa Indonesia yang baik dan benar.""",
            ConversationMode.TECHNICAL: """Anda adalah asisten ahli teknis untuk layanan pemerintah Indonesia.
            Berikan informasi teknis yang detail dengan prosedur, persyaratan, dan regulasi yang spesifik.
            Sertakan referensi hukum dan detail prosedural yang relevan jika diperlukan.
            WAJIB SELALU jawab dalam bahasa Indonesia yang baik dan benar.""",
            ConversationMode.EDUCATIONAL: """Anda adalah asisten pendidikan yang membantu pengguna memahami layanan pemerintah Indonesia.
            Jelaskan konsep dengan jelas, berikan konteks, dan tawarkan panduan langkah demi langkah.
            Sertakan contoh dan analogi untuk membantu pengguna memahami prosedur yang kompleks.
            WAJIB SELALU jawab dalam bahasa Indonesia yang baik dan benar.""",
        }

        # Main prompt template
        self.main_prompt_template = ChatPromptTemplate.from_messages(
            [
                SystemMessagePromptTemplate.from_template(
                    "{system_prompt}\n\n"
                    "Konteks dari dokumen yang relevan:\n{context}\n\n"
                    "Riwayat percakapan:\n{history}\n\n"
                    "Instruksi:\n"
                    "1. Gunakan konteks yang diberikan untuk menjawab pertanyaan dengan akurat\n"
                    "2. Jika informasi tidak tersedia dalam konteks, nyatakan dengan jelas\n"
                    "3. Berikan respons dengan tingkat {response_quality}\n"
                    "4. Sarankan 2-3 pertanyaan lanjutan jika sesuai\n"
                    "5. Sebutkan topik terkait yang mungkin membantu\n"
                    "6. Selalu membantu dan akurat\n"
                    "7. WAJIB: Jawab selalu dalam bahasa Indonesia"
                ),
                HumanMessagePromptTemplate.from_template(
                    "Pertanyaan Pengguna: {question}\n"
                    "Bahasa: {language}\n"
                    "Fokus Topik: {topic_focus}\n\n"
                    "Berikan jawaban yang komprehensif dalam bahasa Indonesia."
                ),
            ]
        )

    async def process_question(
        self,
        question: str,
        conversation_context: ConversationContext,
        include_reasoning: bool = True,
    ) -> EnhancedResponse:
        """Process question with enhanced RAG pipeline and conversation memory"""

        start_time = datetime.now(timezone.utc)
        conversation_id = (
            f"{conversation_context.session_id}_{int(start_time.timestamp())}"
        )

        try:
            # Initialize or get conversation memory
            memory = await self._get_conversation_memory(conversation_context)

            # Retrieve relevant documents
            docs_start = datetime.now(timezone.utc)
            relevant_docs = await self._retrieve_documents(
                question, conversation_context
            )
            retrieval_time = (datetime.now(timezone.utc) - docs_start).total_seconds()

            # Build context from retrieved documents
            context = self._build_enhanced_context(relevant_docs, conversation_context)

            # Get conversation history
            history = self._format_conversation_history(memory)

            # Create metrics callback
            metrics_callback = MetricsCallback()

            # Generate response
            response_start = datetime.now(timezone.utc)
            answer, reasoning = await self._generate_enhanced_response(
                question=question,
                context=context,
                history=history,
                conversation_context=conversation_context,
                callback=metrics_callback,
            )
            response_time = (
                datetime.now(timezone.utc) - response_start
            ).total_seconds()

            # Calculate confidence and quality scores
            confidence = self._calculate_confidence(
                relevant_docs, answer, conversation_context
            )
            retrieval_quality = self._calculate_retrieval_quality(
                relevant_docs, question
            )

            # Generate follow-up suggestions and related topics
            follow_ups = await self._generate_follow_up_suggestions(
                question, answer, conversation_context
            )
            related_topics = self._extract_related_topics(
                relevant_docs, conversation_context
            )

            # Update conversation memory
            await self._update_conversation_memory(
                conversation_context, question, answer, memory
            )

            # Calculate total processing time
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()

            # Create enhanced response
            enhanced_response = EnhancedResponse(
                answer=answer,
                confidence=confidence,
                reasoning=reasoning if include_reasoning else "",
                sources=self._format_sources(relevant_docs),
                conversation_id=conversation_id,
                session_id=conversation_context.session_id,
                processing_time=processing_time,
                model_used=settings.LLM_MODEL,
                retrieval_quality=retrieval_quality,
                context_used=context[:500] + "..." if len(context) > 500 else context,
                follow_up_suggestions=follow_ups,
                related_topics=related_topics,
                timestamp=start_time,
                language=conversation_context.language,
                conversation_mode=conversation_context.conversation_mode,
                response_quality=conversation_context.response_quality,
            )

            # Cache the response
            await self._cache_response(conversation_id, enhanced_response)

            logger.info(
                f"Question processed successfully: "
                f"retrieval={retrieval_time:.2f}s, "
                f"generation={response_time:.2f}s, "
                f"total={processing_time:.2f}s, "
                f"confidence={confidence:.2f}"
            )

            return enhanced_response

        except Exception as e:
            logger.error(f"Question processing failed: {e}")

            # Return error response
            return EnhancedResponse(
                answer=self._get_error_message(conversation_context.language),
                confidence=0.0,
                reasoning="Error occurred during processing",
                sources=[],
                conversation_id=conversation_id,
                session_id=conversation_context.session_id,
                processing_time=(
                    datetime.now(timezone.utc) - start_time
                ).total_seconds(),
                model_used=settings.LLM_MODEL,
                retrieval_quality=0.0,
                context_used="",
                follow_up_suggestions=[],
                related_topics=[],
                timestamp=start_time,
                language=conversation_context.language,
                conversation_mode=conversation_context.conversation_mode,
                response_quality=conversation_context.response_quality,
                error=str(e),
            )

    async def _retrieve_documents(
        self, question: str, context: ConversationContext
    ) -> List[Document]:
        """Retrieve relevant documents with enhanced filtering"""

        try:
            if self.retriever:
                # Add context-aware filtering
                enhanced_query = self._enhance_query_with_context(question, context)
                docs = await asyncio.to_thread(
                    self.retriever.get_relevant_documents, enhanced_query
                )

                # Filter by similarity threshold
                filtered_docs = self._filter_by_similarity(docs, question)

                logger.debug(f"Retrieved {len(filtered_docs)} relevant documents")
                return filtered_docs

            else:
                logger.error("Retriever not available")
                return []

        except Exception as e:
            logger.error(f"Document retrieval failed: {e}")
            return []

    def _enhance_query_with_context(
        self, question: str, context: ConversationContext
    ) -> str:
        """Enhance query with conversation context"""

        enhancements = []

        if context.topic_focus:
            enhancements.append(f"focus: {context.topic_focus}")

        if context.conversation_mode == ConversationMode.TECHNICAL:
            enhancements.append("technical details procedures requirements")
        elif context.conversation_mode == ConversationMode.EDUCATIONAL:
            enhancements.append("explanation tutorial guide step-by-step")

        if enhancements:
            return f"{question} {' '.join(enhancements)}"

        return question

    def _filter_by_similarity(
        self, docs: List[Document], question: str
    ) -> List[Document]:
        """Filter documents by similarity threshold"""

        filtered_docs = []
        for doc in docs:
            # Use metadata score if available, otherwise calculate simple score
            score = doc.metadata.get("relevance_score", 0.7)

            if score >= settings.RAG_SIMILARITY_THRESHOLD:
                filtered_docs.append(doc)

        return filtered_docs

    def _build_enhanced_context(
        self, documents: List[Document], conversation_context: ConversationContext
    ) -> str:
        """Build enhanced context from retrieved documents"""

        if not documents:
            return self._get_no_context_message(conversation_context.language)

        context_parts = []

        for i, doc in enumerate(documents, 1):
            source = doc.metadata.get("source", "Unknown")
            page = doc.metadata.get("page", "N/A")
            score = doc.metadata.get("relevance_score", "N/A")

            context_parts.append(f"[Document {i}]")
            context_parts.append(f"Source: {source} (Page: {page}, Relevance: {score})")
            context_parts.append(f"Content: {doc.page_content}")
            context_parts.append("---")

        return "\n".join(context_parts)

    async def _get_conversation_memory(
        self, context: ConversationContext
    ) -> BaseMemory:
        """Get or create conversation memory for session"""

        session_id = context.session_id

        if session_id not in self.conversation_memory:
            # Create new memory based on conversation mode
            if context.conversation_mode == ConversationMode.TECHNICAL:
                # Use summary buffer for technical conversations (more context)
                memory = ConversationSummaryBufferMemory(
                    llm=self.llm,
                    max_token_limit=2000,
                    return_messages=True,
                    memory_key="history",
                )
            else:
                # Use window memory for other modes
                memory = ConversationBufferWindowMemory(
                    k=context.max_history, return_messages=True, memory_key="history"
                )

            self.conversation_memory[session_id] = memory

            # Try to load from cache
            await self._load_memory_from_cache(session_id, memory)

        return self.conversation_memory[session_id]

    def _format_conversation_history(self, memory: BaseMemory) -> str:
        """Format conversation history for prompt"""

        try:
            memory_variables = memory.load_memory_variables({})
            messages = memory_variables.get("history", [])

            if not messages:
                return "No previous conversation."

            formatted_history = []
            for message in messages[-10:]:  # Last 10 messages
                if isinstance(message, HumanMessage):
                    formatted_history.append(f"User: {message.content}")
                elif isinstance(message, AIMessage):
                    formatted_history.append(f"Assistant: {message.content}")

            return "\n".join(formatted_history)

        except Exception as e:
            logger.error(f"Failed to format conversation history: {e}")
            return "No previous conversation."

    async def _generate_enhanced_response(
        self,
        question: str,
        context: str,
        history: str,
        conversation_context: ConversationContext,
        callback: MetricsCallback,
    ) -> Tuple[str, str]:
        """Generate enhanced response with reasoning"""

        try:
            # Select system prompt based on conversation mode
            system_prompt = self.system_prompts[conversation_context.conversation_mode]

            # Format prompt
            prompt_input = {
                "system_prompt": system_prompt,
                "context": context,
                "history": history,
                "question": question,
                "language": conversation_context.language,
                "response_quality": conversation_context.response_quality.value,
                "topic_focus": conversation_context.topic_focus or "general",
            }

            # Generate response
            formatted_prompt = self.main_prompt_template.format(**prompt_input)

            # Use LLM with callback
            response = await asyncio.to_thread(
                self.llm.invoke, formatted_prompt, config={"callbacks": [callback]}
            )

            answer = response.content if hasattr(response, "content") else str(response)

            # Generate reasoning if requested
            reasoning = await self._generate_reasoning(
                question, answer, context, conversation_context
            )

            return answer, reasoning

        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            error_msg = self._get_error_message(conversation_context.language)
            return error_msg, f"Error during generation: {str(e)}"

    async def _generate_reasoning(
        self,
        question: str,
        answer: str,
        context: str,
        conversation_context: ConversationContext,
    ) -> str:
        """Generate reasoning explanation for the answer"""

        try:
            reasoning_prompt = f"""
            Explain briefly how you arrived at this answer:

            Question: {question}
            Answer: {answer}
            Context available: {len(context)} characters

            Provide a concise explanation of your reasoning process in {conversation_context.language}.
            """

            reasoning_response = await asyncio.to_thread(
                self.llm.invoke, reasoning_prompt
            )

            return (
                reasoning_response.content
                if hasattr(reasoning_response, "content")
                else str(reasoning_response)
            )

        except Exception as e:
            logger.error(f"Reasoning generation failed: {e}")
            return "Reasoning explanation not available"

    def _calculate_confidence(
        self, documents: List[Document], answer: str, context: ConversationContext
    ) -> float:
        """Calculate confidence score based on various factors"""

        base_confidence = 0.5

        # Document relevance factor
        if documents:
            avg_relevance = sum(
                doc.metadata.get("relevance_score", 0.7) for doc in documents
            ) / len(documents)
            base_confidence += (avg_relevance - 0.5) * 0.3

        # Answer length factor (within reasonable bounds)
        answer_length = len(answer.split())
        if 20 <= answer_length <= 200:
            base_confidence += 0.1

        # Context mode factor
        if context.conversation_mode == ConversationMode.TECHNICAL:
            base_confidence += 0.05  # Technical mode typically more precise

        # Clamp between 0 and 1
        return max(0.0, min(1.0, base_confidence))

    def _calculate_retrieval_quality(
        self, documents: List[Document], question: str
    ) -> float:
        """Calculate quality of document retrieval"""

        if not documents:
            return 0.0

        # Basic quality based on number of documents and their scores
        quality_scores = [doc.metadata.get("relevance_score", 0.7) for doc in documents]

        avg_quality = sum(quality_scores) / len(quality_scores)

        # Bonus for having multiple relevant documents
        if len(documents) >= 3:
            avg_quality += 0.1

        return max(0.0, min(1.0, avg_quality))

    async def _generate_follow_up_suggestions(
        self, question: str, answer: str, context: ConversationContext
    ) -> List[str]:
        """Generate follow-up question suggestions"""

        try:
            follow_up_prompt = f"""
            Based on this Q&A exchange, suggest 3 relevant follow-up questions that a user might ask:

            Original Question: {question}
            Answer: {answer}

            Return only the questions, one per line, without numbering or bullets.
            Make them relevant to Indonesian government services.
            Answer in {context.language}.
            """

            response = await asyncio.to_thread(self.llm.invoke, follow_up_prompt)
            suggestions = response.content.strip().split("\n")

            # Clean and limit suggestions
            clean_suggestions = [
                s.strip()
                for s in suggestions
                if s.strip() and not s.strip().startswith(("1.", "2.", "3.", "-", "*"))
            ][:3]

            return clean_suggestions

        except Exception as e:
            logger.error(f"Follow-up generation failed: {e}")
            return []

    def _extract_related_topics(
        self, documents: List[Document], context: ConversationContext
    ) -> List[str]:
        """Extract related topics from retrieved documents"""

        topics = set()

        for doc in documents:
            # Extract topics from metadata if available
            doc_topics = doc.metadata.get("topics", [])
            if isinstance(doc_topics, list):
                topics.update(doc_topics)

            # Simple keyword extraction
            content_lower = doc.page_content.lower()
            keywords = [
                "pajak",
                "ktp",
                "sim",
                "paspor",
                "akta",
                "sertifikat",
                "pendaftaran",
                "perizinan",
                "layanan",
                "administrasi",
            ]

            for keyword in keywords:
                if keyword in content_lower:
                    topics.add(keyword.title())

        return list(topics)[:5]  # Limit to 5 topics

    def _format_sources(self, documents: List[Document]) -> List[Dict[str, Any]]:
        """Format document sources for response"""

        sources = []
        for doc in documents:
            source_info = {
                "title": doc.metadata.get("source", "Unknown Document"),
                "page": doc.metadata.get("page", "N/A"),
                "document_id": doc.metadata.get("document_id", "unknown"),
                "relevance_score": doc.metadata.get("relevance_score", 0.0),
                "excerpt": (
                    doc.page_content[:200] + "..."
                    if len(doc.page_content) > 200
                    else doc.page_content
                ),
            }
            sources.append(source_info)

        return sources

    async def _update_conversation_memory(
        self,
        context: ConversationContext,
        question: str,
        answer: str,
        memory: BaseMemory,
    ):
        """Update conversation memory with new exchange"""

        try:
            # Add to memory
            memory.save_context({"input": question}, {"output": answer})

            # Cache updated memory
            await self._cache_memory(context.session_id, memory)

            # Update context timestamp
            context.updated_at = datetime.now(timezone.utc)

        except Exception as e:
            logger.error(f"Failed to update conversation memory: {e}")

    async def _cache_response(self, conversation_id: str, response: EnhancedResponse):
        """Cache response for future reference"""

        if not self.redis_client:
            return

        try:
            cache_key = f"langchain_response:{conversation_id}"
            response_data = response.to_dict()

            await asyncio.to_thread(
                self.redis_client.setex,
                cache_key,
                3600,  # 1 hour cache
                json.dumps(response_data, default=str),
            )

        except Exception as e:
            logger.error(f"Failed to cache response: {e}")

    async def _cache_memory(self, session_id: str, memory: BaseMemory):
        """Cache conversation memory"""

        if not self.redis_client:
            return

        try:
            cache_key = f"langchain_memory:{session_id}"
            memory_data = memory.load_memory_variables({})

            await asyncio.to_thread(
                self.redis_client.setex,
                cache_key,
                86400,  # 24 hour cache
                json.dumps(memory_data, default=str),
            )

        except Exception as e:
            logger.error(f"Failed to cache memory: {e}")

    async def _load_memory_from_cache(self, session_id: str, memory: BaseMemory):
        """Load conversation memory from cache"""

        if not self.redis_client:
            return

        try:
            cache_key = f"langchain_memory:{session_id}"
            cached_data = await asyncio.to_thread(self.redis_client.get, cache_key)

            if cached_data:
                memory_data = json.loads(cached_data)
                messages = memory_data.get("history", [])

                # Reconstruct conversation in memory
                for i in range(0, len(messages) - 1, 2):
                    if i + 1 < len(messages):
                        user_msg = messages[i]
                        ai_msg = messages[i + 1]

                        memory.save_context({"input": user_msg}, {"output": ai_msg})

        except Exception as e:
            logger.error(f"Failed to load memory from cache: {e}")

    def _get_error_message(self, language: str) -> str:
        """Get error message in appropriate language"""

        if language == "id":
            return "Maaf, terjadi kesalahan dalam memproses pertanyaan Anda. Silakan coba lagi."
        else:
            return "I'm sorry, there was an error processing your question. Please try again."

    def _get_no_context_message(self, language: str) -> str:
        """Get no context message in appropriate language"""

        if language == "id":
            return "Tidak ada dokumen yang relevan ditemukan untuk pertanyaan ini."
        else:
            return "No relevant documents found for this question."

    async def add_document_to_vectorstore(
        self,
        document_path: str,
        document_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Add document to vector store with enhanced metadata"""

        try:
            # Load document based on file type
            if document_path.endswith(".pdf"):
                from langchain_community.document_loaders import PyPDFLoader

                loader = PyPDFLoader(document_path)
            elif document_path.endswith(".txt"):
                from langchain_community.document_loaders import TextLoader

                loader = TextLoader(document_path)
            else:
                logger.error(f"Unsupported document type: {document_path}")
                return False

            documents = await asyncio.to_thread(loader.load)

            # Split documents into chunks
            chunks = self.text_splitter.split_documents(documents)

            # Add enhanced metadata
            for chunk in chunks:
                chunk.metadata.update(
                    {
                        "document_id": document_id,
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                        "service": "langchain_enhanced",
                    }
                )

                if metadata:
                    chunk.metadata.update(metadata)

            # Add to vector store
            if self.vectorstore and hasattr(self.vectorstore, "add_documents"):
                await asyncio.to_thread(self.vectorstore.add_documents, chunks)

            logger.info(
                f"Document {document_id} added to vector store with {len(chunks)} chunks"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to add document to vector store: {e}")
            return False

    async def get_conversation_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get formatted conversation history for session"""

        try:
            memory = await self._get_conversation_memory(
                ConversationContext(session_id=session_id)
            )

            memory_data = memory.load_memory_variables({})
            messages = memory_data.get("history", [])

            formatted_history = []
            for i in range(0, len(messages) - 1, 2):
                if i + 1 < len(messages):
                    user_msg = messages[i]
                    ai_msg = messages[i + 1]

                    formatted_history.append(
                        {
                            "user_message": user_msg,
                            "ai_response": ai_msg,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )

            return formatted_history

        except Exception as e:
            logger.error(f"Failed to get conversation history: {e}")
            return []

    async def clear_conversation_memory(self, session_id: str) -> bool:
        """Clear conversation memory for session"""

        try:
            # Remove from memory
            if session_id in self.conversation_memory:
                del self.conversation_memory[session_id]

            # Remove from cache
            if self.redis_client:
                cache_key = f"langchain_memory:{session_id}"
                await asyncio.to_thread(self.redis_client.delete, cache_key)

            logger.info(f"Cleared conversation memory for session: {session_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to clear conversation memory: {e}")
            return False

    async def _get_institution_context(
        self, institution_slug: Optional[str] = None
    ) -> Tuple[str, str]:
        """Get institution context for typo correction based on institution slug"""
        try:
            if not institution_slug:
                return "pelayanan publik Indonesia", "Indonesian public services"

            async for db in get_db_session():
                result = await db.execute(
                    select(Institution).where(Institution.slug == institution_slug)
                )
                institution = result.scalar_one_or_none()

                if institution:
                    # Build context from institution data
                    institution_context = f"pelayanan {institution.name}"
                    if institution.description:
                        institution_context += f" ({institution.description})"

                    # For English, use a generic translation
                    institution_context_en = f"{institution.name} services"
                    if institution.description:
                        institution_context_en += f" ({institution.description})"

                    return institution_context, institution_context_en
                else:
                    # Fallback to generic if institution not found
                    logger.warning(
                        f"Institution not found for slug: {institution_slug}"
                    )
                    return "pelayanan publik Indonesia", "Indonesian public services"

        except Exception as e:
            logger.error(f"Error getting institution context: {e}")
            return "pelayanan publik Indonesia", "Indonesian public services"

    async def correct_typo_question(
        self,
        question: str,
        language: str = "id",
        institution_slug: Optional[str] = None,
    ) -> str:
        """Correct typos in the question using LLM, focusing only on spelling/typo, not grammar or structure. Context-aware based on institution."""

        # Get dynamic institution context from database
        institution_context, institution_context_en = (
            await self._get_institution_context(institution_slug)
        )

        if language == "id":
            prompt = (
                "Perbaiki hanya kesalahan ketik (typo) pada pertanyaan berikut, tanpa mengubah struktur kalimat atau memperbaiki tata bahasa. "
                f"Fokus pada konteks {institution_context}. "
                "PENTING: Jangan mengubah singkatan yang benar seperti SIM (Surat Izin Mengemudi), KTP (Kartu Tanda Penduduk), SKCK, dll. "
                "Pastikan tidak ada tanda baca yang salah. "
                "Kembalikan hanya pertanyaan yang telah diperbaiki tanpa penjelasan apapun.\n"
                f"PERTANYAAN: {question}"
            )
        else:
            prompt = (
                "Correct only the typos in the following question, without changing the sentence structure or grammar. "
                f"Focus on the context of {institution_context_en}. "
                "IMPORTANT: Do not change correct abbreviations like SIM (driver's license), KTP (ID card), SKCK, etc. "
                "Ensure there are no incorrect punctuation marks. "
                "Return only the corrected question, without any explanation.\n"
                f"QUESTION: {question}"
            )
        response = await asyncio.to_thread(self.llm.invoke, prompt)
        return (
            response.content.strip()
            if hasattr(response, "content")
            else str(response).strip()
        )

    async def generate_summary(self, conversation_text: str) -> str:
        """
        Generate summary and title for the conversation using LLM.

        Args:
            conversation_text: The full text of the conversation.

        Returns:
            Dict containing the generated summary and title.
        """
        try:
            # Create the prompt for the LLM
            prompt = f"""
            Berdasarkan percakapan berikut, buatlah ringkasan dalam format paragraf naratif yang mencakup poin-poin penting dari diskusi:

            PERCAKAPAN:
            {conversation_text}

            TUGAS:
            1. Ringkas percakapan ini dalam 1-3 paragraf (tergantung panjang percakapan)
            2. Fokus pada topik utama, poin penting, dan kesimpulan
            3. Gunakan bahasa Indonesia yang jelas dan mudah dipahami
            4. Hindari penggunaan kalimat pengantar seperti "berikut hasil rangkuman" atau kata-kata penghubung lainnya.
            5. Jangan menggunakan format dialog, tapi buatlah dalam bentuk paragraf deskriptif.

            RINGKASAN:
            """

            # Call the LLM for generating summary and title
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            return (
                response.content.strip()
                if hasattr(response, "content")
                else str(response).strip()
            )
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            return "Gagal menghasilkan ringkasan percakapan"

    async def generate_title_of_summary(self, summary_text: str) -> str:
        try:
            prompt = f"""
            Berdasarkan ringkasan percakapan berikut, buatlah judul yang singkat dan deskriptif:

            RINGKASAN:
            {summary_text}

            TUGAS:
            1. Buat judul yang menggambarkan topik utama percakapan.
            2. Judul maksimal terdiri dari 8-10 kata.
            3. Gunakan bahasa Indonesia yang jelas dan lugas.
            4. Hindari penggunaan kata-kata umum seperti "ringkasan", "percakapan", atau istilah generik lainnya.
            5. Fokuskan judul pada substansi/topik yang dibahas tanpa menambahkan karakter atau tanda selain kata-kata yang relevan.


            JUDUL:
            """

            # Call the LLM for generating summary and title
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            raw_title = (
                response.content.strip()
                if hasattr(response, "content")
                else str(response).strip()
            )

            # Clean up the title in case LLM returns JSON array or malformed response
            cleaned_title = self._clean_llm_title_response(raw_title)
            return cleaned_title
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            return "Gagal menghasilkan ringkasan percakapan"

    def _clean_llm_title_response(self, raw_title: str) -> str:
        """
        Clean LLM response to extract proper title text from malformed responses
        """
        try:
            # Remove common prefixes and suffixes
            cleaned = raw_title.strip()

            # Remove "JUDUL:" prefix if present
            if cleaned.upper().startswith("JUDUL:"):
                cleaned = cleaned[6:].strip()

            # Check if response looks like JSON array string representation
            if cleaned.startswith("[") and "," in cleaned and cleaned.endswith("]"):
                try:
                    # Try to parse as JSON array and join characters
                    import json

                    char_array = json.loads(cleaned)
                    if isinstance(char_array, list):
                        # Join characters to form the actual title
                        cleaned = "".join(str(char) for char in char_array)
                except (json.JSONDecodeError, TypeError):
                    # If JSON parsing fails, try to extract text manually
                    # Remove brackets and quotes, split by comma, join characters
                    cleaned = cleaned.strip("[]")
                    cleaned = cleaned.replace("'", "").replace('"', "")
                    if "," in cleaned:
                        chars = [char.strip() for char in cleaned.split(",")]
                        cleaned = "".join(chars)

            # Remove extra quotes and whitespace
            cleaned = cleaned.strip("\"'")

            # Fallback if still looks malformed
            if len(cleaned) < 5 or any(
                char in cleaned for char in ["[", "]", "{", "}"]
            ):
                return "Ringkasan Percakapan Tunarasa"

            return cleaned

        except Exception as e:
            logger.error(f"Failed to clean title response: {e}")
            return "Ringkasan Percakapan Tunarasa"


# Global service instance
_langchain_service: Optional[EnhancedLangChainService] = None


def get_langchain_service() -> EnhancedLangChainService:
    """Get or create enhanced LangChain service instance"""
    global _langchain_service
    if _langchain_service is None:
        _langchain_service = EnhancedLangChainService()
    return _langchain_service


# Convenience functions for easier integration
async def process_question_simple(
    question: str,
    session_id: str,
    language: str = "en",
    conversation_mode: str = "casual",
) -> Dict[str, Any]:
    """Simple interface for question processing"""

    service = get_langchain_service()

    context = ConversationContext(
        session_id=session_id,
        language=language,
        conversation_mode=ConversationMode(conversation_mode),
        response_quality=ResponseQuality.DETAILED,
    )

    response = await service.process_question(question, context)
    return response.to_dict()


async def add_document_simple(document_path: str, document_id: str) -> bool:
    """Simple interface for adding documents"""

    service = get_langchain_service()
    return await service.add_document_to_vectorstore(document_path, document_id)
