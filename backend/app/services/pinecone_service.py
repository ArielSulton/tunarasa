"""
Comprehensive Pinecone Vector Database Service for Tunarasa RAG System

This service provides complete document management, ingestion, and retrieval capabilities
for the Tunarasa knowledge base using Pinecone vector database.

Features:
- Document ingestion pipeline with chunking and embeddings
- Vector search with similarity scoring and metadata filtering
- Support for PDF, text, and markdown documents
- Batch processing for large document sets
- Document versioning and metadata management
- Integration with existing LangChain service
"""

import asyncio
import json
import logging
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# FastAPI and async
import aiofiles
from app.core.config import settings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_pinecone import PineconeEmbeddings

# Core libraries
from pinecone import Pinecone, ServerlessSpec

# Document processing
from pypdf import PdfReader

# Removed OpenAI imports - using PineconeEmbeddings instead


logger = logging.getLogger(__name__)


class DocumentType(Enum):
    """Supported document types for processing"""

    PDF = "pdf"
    TEXT = "txt"
    MARKDOWN = "md"
    JSON = "json"


class ProcessingStatus(Enum):
    """Document processing status"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"


@dataclass
class DocumentMetadata:
    """Enhanced document metadata structure"""

    document_id: str
    filename: str
    file_path: str
    document_type: DocumentType
    file_size: int
    upload_timestamp: datetime
    processing_status: ProcessingStatus
    version: int = 1
    title: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    language: str = "id"  # Default to Indonesian
    topics: List[str] = None
    chunk_count: int = 0
    embedding_model: str = settings.EMBEDDING_MODEL
    processing_time: Optional[float] = None
    error_message: Optional[str] = None
    last_accessed: Optional[datetime] = None
    access_count: int = 0

    def __post_init__(self):
        if self.topics is None:
            self.topics = []
        if self.upload_timestamp is None:
            self.upload_timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result["upload_timestamp"] = self.upload_timestamp.isoformat()
        result["document_type"] = self.document_type.value
        result["processing_status"] = self.processing_status.value
        if self.last_accessed:
            result["last_accessed"] = self.last_accessed.isoformat()
        return result


@dataclass
class SearchResult:
    """Search result with enhanced metadata"""

    document_id: str
    chunk_id: str
    content: str
    similarity_score: float
    metadata: Dict[str, Any]
    page_number: Optional[int] = None
    chunk_index: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class SearchQuery:
    """Enhanced search query configuration"""

    query_text: str
    top_k: int = 5
    similarity_threshold: float = 0.7
    metadata_filter: Optional[Dict[str, Any]] = None
    include_metadata: bool = True
    language: str = "id"
    document_types: Optional[List[DocumentType]] = None
    date_range: Optional[Tuple[datetime, datetime]] = None
    namespace: Optional[str] = None  # Institution-specific namespace

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        result = asdict(self)
        if self.document_types:
            result["document_types"] = [dt.value for dt in self.document_types]
        if self.date_range:
            result["date_range"] = [dt.isoformat() for dt in self.date_range]
        return result


class DocumentProcessor:
    """Document processing utilities for different file types"""

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    async def process_document(
        self, file_path: str, document_metadata: DocumentMetadata
    ) -> List[Document]:
        """Process document and return chunks with metadata"""

        try:
            # Determine document type
            doc_type = self._detect_document_type(file_path)
            document_metadata.document_type = doc_type

            # Extract text based on document type
            if doc_type == DocumentType.PDF:
                text_content = await self._extract_pdf_text(file_path)
            elif doc_type == DocumentType.MARKDOWN:
                text_content = await self._extract_markdown_text(file_path)
            elif doc_type == DocumentType.TEXT:
                text_content = await self._extract_text_content(file_path)
            elif doc_type == DocumentType.JSON:
                text_content = await self._extract_json_text(file_path)
            else:
                raise ValueError(f"Unsupported document type: {doc_type}")

            # Clean and preprocess text
            cleaned_text = self._clean_text(text_content)

            # Split into chunks
            chunks = await self._create_chunks(cleaned_text, document_metadata)

            # Update metadata
            document_metadata.chunk_count = len(chunks)
            document_metadata.processing_status = ProcessingStatus.COMPLETED

            logger.info(
                f"Document processed successfully: {document_metadata.document_id}, "
                f"chunks: {len(chunks)}"
            )

            return chunks

        except Exception as e:
            document_metadata.processing_status = ProcessingStatus.FAILED
            document_metadata.error_message = str(e)
            logger.error(f"Document processing failed: {e}")
            raise

    def _detect_document_type(self, file_path: str) -> DocumentType:
        """Detect document type from file extension"""

        file_extension = Path(file_path).suffix.lower()

        if file_extension == ".pdf":
            return DocumentType.PDF
        elif file_extension in [".txt", ".text"]:
            return DocumentType.TEXT
        elif file_extension in [".md", ".markdown"]:
            return DocumentType.MARKDOWN
        elif file_extension == ".json":
            return DocumentType.JSON
        else:
            # Default to text for unknown types
            return DocumentType.TEXT

    async def _extract_pdf_text(self, file_path: str) -> str:
        """Extract text from PDF file"""

        try:

            def extract_sync():
                reader = PdfReader(file_path)
                text_content = []

                for page_num, page in enumerate(reader.pages, 1):
                    try:
                        text = page.extract_text()
                        if text.strip():
                            # Add page marker for reference
                            text_content.append(f"[Page {page_num}]\n{text}")
                    except Exception as e:
                        logger.warning(f"Failed to extract page {page_num}: {e}")
                        continue

                return "\n\n".join(text_content)

            # Run PDF extraction in thread pool
            text_content = await asyncio.to_thread(extract_sync)

            if not text_content.strip():
                raise ValueError("No text content extracted from PDF")

            return text_content

        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            raise

    async def _extract_markdown_text(self, file_path: str) -> str:
        """Extract text from Markdown file"""

        try:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as file:
                markdown_content = await file.read()

            # Convert markdown to plain text (remove markdown syntax)
            # Keep headers for structure
            lines = markdown_content.split("\n")
            cleaned_lines = []

            for line in lines:
                # Convert headers to plain text
                if line.startswith("#"):
                    level = len(line) - len(line.lstrip("#"))
                    title = line.lstrip("# ").strip()
                    cleaned_lines.append(f"{'=' * level} {title} {'=' * level}")
                else:
                    # Remove basic markdown syntax
                    cleaned_line = (
                        line.replace("**", "").replace("*", "").replace("`", "")
                    )
                    cleaned_lines.append(cleaned_line)

            return "\n".join(cleaned_lines)

        except Exception as e:
            logger.error(f"Markdown text extraction failed: {e}")
            raise

    async def _extract_text_content(self, file_path: str) -> str:
        """Extract text from plain text file"""

        try:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as file:
                content = await file.read()

            return content

        except UnicodeDecodeError:
            # Try with different encoding
            try:
                async with aiofiles.open(file_path, "r", encoding="latin-1") as file:
                    content = await file.read()
                return content
            except Exception as e:
                logger.error(f"Text extraction failed with multiple encodings: {e}")
                raise
        except Exception as e:
            logger.error(f"Text extraction failed: {e}")
            raise

    async def _extract_json_text(self, file_path: str) -> str:
        """Extract searchable text from JSON file"""

        try:
            async with aiofiles.open(file_path, "r", encoding="utf-8") as file:
                json_content = await file.read()

            data = json.loads(json_content)

            # Extract text values recursively
            text_parts: List[str] = []
            self._extract_text_from_json(data, text_parts)

            return "\n".join(text_parts)

        except Exception as e:
            logger.error(f"JSON text extraction failed: {e}")
            raise

    def _extract_text_from_json(self, obj: Any, text_parts: List[str]):
        """Recursively extract text from JSON object"""

        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str) and len(value.strip()) > 0:
                    text_parts.append(f"{key}: {value}")
                else:
                    self._extract_text_from_json(value, text_parts)
        elif isinstance(obj, list):
            for item in obj:
                self._extract_text_from_json(item, text_parts)
        elif isinstance(obj, str) and len(obj.strip()) > 0:
            text_parts.append(obj)

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text content"""

        # Remove excessive whitespace
        lines = text.split("\n")
        cleaned_lines = []

        for line in lines:
            cleaned_line = line.strip()
            if cleaned_line:
                # Normalize whitespace
                cleaned_line = " ".join(cleaned_line.split())
                cleaned_lines.append(cleaned_line)

        # Join with single newlines
        cleaned_text = "\n".join(cleaned_lines)

        # Remove excessive newlines (more than 2 consecutive)
        import re

        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)

        return cleaned_text

    async def _create_chunks(
        self, text: str, document_metadata: DocumentMetadata
    ) -> List[Document]:
        """Create document chunks with enhanced metadata"""

        try:
            # Split text into chunks
            chunks = await asyncio.to_thread(self.text_splitter.split_text, text)

            # Create Document objects with metadata
            documents = []
            for i, chunk in enumerate(chunks):
                # Create unique chunk ID
                chunk_id = f"{document_metadata.document_id}_chunk_{i}"

                # Enhanced chunk metadata
                chunk_metadata = {
                    "document_id": document_metadata.document_id,
                    "chunk_id": chunk_id,
                    "chunk_index": i,
                    "total_chunks": len(chunks),
                    "filename": document_metadata.filename,
                    "document_type": document_metadata.document_type.value,
                    "language": document_metadata.language,
                    "upload_timestamp": document_metadata.upload_timestamp.isoformat(),
                    "version": document_metadata.version,
                    "topics": document_metadata.topics,
                    "chunk_size": len(chunk),
                    "embedding_model": document_metadata.embedding_model,
                }

                # Add optional fields only if they have values (Pinecone doesn't accept null)
                if document_metadata.author:
                    chunk_metadata["author"] = document_metadata.author
                if document_metadata.title:
                    chunk_metadata["title"] = document_metadata.title
                if document_metadata.description:
                    chunk_metadata["description"] = document_metadata.description

                # Create Document object
                doc = Document(page_content=chunk, metadata=chunk_metadata)

                documents.append(doc)

            return documents

        except Exception as e:
            logger.error(f"Chunk creation failed: {e}")
            raise


class PineconeVectorService:
    """Comprehensive Pinecone vector database service"""

    def __init__(self):
        self.client: Optional[Pinecone] = None
        self.index = None
        self.embeddings: Optional[PineconeEmbeddings] = None
        self.document_processor = DocumentProcessor()
        self.document_metadata_cache: Dict[str, DocumentMetadata] = {}

        # Initialize components
        self._initialize_pinecone()
        self._initialize_embeddings()
        self._initialize_index()

        logger.info("Pinecone Vector Service initialized successfully")

    def _initialize_pinecone(self):
        """Initialize Pinecone client"""

        try:
            if not settings.PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY not found in settings")

            self.client = Pinecone(api_key=settings.PINECONE_API_KEY)

            logger.info("Pinecone client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Pinecone client: {e}")
            raise

    def _initialize_embeddings(self):
        """Initialize Pinecone embeddings with multilingual-e5-large"""

        try:
            if not settings.PINECONE_API_KEY:
                raise ValueError("PINECONE_API_KEY not found in settings")

            self.embeddings = PineconeEmbeddings(
                model=settings.EMBEDDING_MODEL,
                pinecone_api_key=settings.PINECONE_API_KEY,
            )

            logger.info(
                f"Pinecone embeddings ({settings.EMBEDDING_MODEL}) initialized successfully"
            )

        except Exception as e:
            logger.error(f"Failed to initialize embeddings: {e}")
            raise

    def _initialize_index(self):
        """Initialize or create Pinecone index"""

        try:
            if not self.client:
                raise ValueError("Pinecone client not initialized")

            index_name = settings.PINECONE_INDEX_NAME

            # Check if index exists
            existing_indexes = self.client.list_indexes().names()

            if index_name not in existing_indexes:
                try:
                    # Create index with proper configuration
                    self.client.create_index(
                        name=index_name,
                        dimension=1536,  # multilingual-e5-large embedding dimension
                        metric="cosine",
                        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                    )

                    logger.info(f"Created Pinecone index: {index_name}")

                    # Wait for index to be ready
                    import time

                    time.sleep(10)
                except Exception as create_error:
                    if (
                        "ALREADY_EXISTS" in str(create_error)
                        or "already exists" in str(create_error).lower()
                    ):
                        logger.info(
                            f"Pinecone index {index_name} already exists, continuing..."
                        )
                    else:
                        logger.error(f"Failed to create Pinecone index: {create_error}")
                        raise

            # Connect to index
            try:
                self.index = self.client.Index(index_name)
                logger.info(f"Connected to Pinecone index: {index_name}")

                # Verify index connection
                stats = self.index.describe_index_stats()
                logger.info(f"Index stats: {stats.total_vector_count} vectors")

            except Exception as index_error:
                if (
                    "ALREADY_EXISTS" in str(index_error)
                    or "already exists" in str(index_error).lower()
                ):
                    logger.warning(
                        f"Pinecone index access issue, retrying: {index_error}"
                    )
                    # Retry connection
                    self.index = self.client.Index(index_name)
                else:
                    logger.error(f"Failed to connect to Pinecone index: {index_error}")
                    raise

        except Exception as e:
            logger.error(f"Failed to initialize Pinecone index: {e}")
            # Don't raise the error - allow the service to continue without Pinecone
            self.index = None
            self.client = None

    async def ingest_document(
        self,
        file_path: str,
        document_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None,
    ) -> DocumentMetadata:
        """Ingest a single document into the vector database"""

        start_time = datetime.now(timezone.utc)

        try:
            # Generate document ID if not provided
            if not document_id:
                document_id = str(uuid.uuid4())

            # Create document metadata
            file_stats = os.stat(file_path)
            filename = os.path.basename(file_path)

            doc_metadata = DocumentMetadata(
                document_id=document_id,
                filename=filename,
                file_path=file_path,
                document_type=DocumentType.TEXT,  # Will be updated during processing
                file_size=file_stats.st_size,
                upload_timestamp=datetime.now(timezone.utc),
                processing_status=ProcessingStatus.PROCESSING,
            )

            # Add custom metadata if provided
            if metadata:
                if "title" in metadata:
                    doc_metadata.title = metadata["title"]
                if "description" in metadata:
                    doc_metadata.description = metadata["description"]
                if "author" in metadata:
                    doc_metadata.author = metadata["author"]
                if "language" in metadata:
                    doc_metadata.language = metadata["language"]
                if "topics" in metadata:
                    doc_metadata.topics = metadata["topics"]

            logger.info(f"Starting document ingestion: {document_id}")

            # Process document into chunks
            chunks = await self.document_processor.process_document(
                file_path, doc_metadata
            )

            # Generate embeddings for chunks with namespace
            await self._embed_and_store_chunks(chunks, doc_metadata, namespace)

            # Calculate processing time
            processing_time = (datetime.now(timezone.utc) - start_time).total_seconds()
            doc_metadata.processing_time = processing_time

            # Cache metadata
            self.document_metadata_cache[document_id] = doc_metadata

            logger.info(
                f"Document ingestion completed: {document_id}, "
                f"chunks: {doc_metadata.chunk_count}, "
                f"time: {processing_time:.2f}s"
            )

            return doc_metadata

        except Exception as e:
            logger.error(f"Document ingestion failed: {e}")

            # Update metadata with error
            if "doc_metadata" in locals():
                doc_metadata.processing_status = ProcessingStatus.FAILED
                doc_metadata.error_message = str(e)
                doc_metadata.processing_time = (
                    datetime.now(timezone.utc) - start_time
                ).total_seconds()

            raise

    async def _embed_and_store_chunks(
        self,
        chunks: List[Document],
        doc_metadata: DocumentMetadata,
        namespace: Optional[str] = None,
    ):
        """Generate embeddings and store chunks in Pinecone"""

        try:
            if not chunks:
                raise ValueError("No chunks to process")

            # Extract text content for embedding
            texts = [chunk.page_content for chunk in chunks]

            # Generate embeddings in batches
            batch_size = 25  # Pinecone batch size limit
            all_vectors = []

            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i : i + batch_size]
                batch_chunks = chunks[i : i + batch_size]

                # Generate embeddings for batch
                embeddings = await asyncio.to_thread(
                    self.embeddings.embed_documents, batch_texts
                )

                # Prepare vectors for Pinecone
                batch_vectors = []
                for j, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings)):
                    vector_id = chunk.metadata["chunk_id"]

                    # Prepare metadata for Pinecone (must be simple types)
                    pinecone_metadata = {
                        "document_id": chunk.metadata["document_id"],
                        "chunk_index": chunk.metadata["chunk_index"],
                        "filename": chunk.metadata["filename"],
                        "document_type": chunk.metadata["document_type"],
                        "language": chunk.metadata["language"],
                        "upload_timestamp": chunk.metadata["upload_timestamp"],
                        "version": chunk.metadata["version"],
                        "chunk_size": chunk.metadata["chunk_size"],
                        "content": chunk.page_content[
                            :1000
                        ],  # First 1000 chars for search
                        "title": chunk.metadata.get("title", ""),
                        "author": chunk.metadata.get("author", ""),
                        "topics": ",".join(chunk.metadata.get("topics", [])),
                    }

                    batch_vectors.append(
                        {
                            "id": vector_id,
                            "values": embedding,
                            "metadata": pinecone_metadata,
                        }
                    )

                all_vectors.extend(batch_vectors)

            # Store all vectors in Pinecone with namespace
            await self._store_vectors_batch(all_vectors, namespace)

            logger.info(
                f"Stored {len(all_vectors)} vectors for document {doc_metadata.document_id}"
            )

        except Exception as e:
            logger.error(f"Embedding and storage failed: {e}")
            raise

    async def _store_vectors_batch(
        self, vectors: List[Dict[str, Any]], namespace: Optional[str] = None
    ):
        """Store vectors in Pinecone in batches"""

        try:
            batch_size = 100  # Pinecone upsert batch size

            for i in range(0, len(vectors), batch_size):
                batch = vectors[i : i + batch_size]

                # Upsert batch to Pinecone with namespace
                if namespace:
                    await asyncio.to_thread(
                        self.index.upsert, vectors=batch, namespace=namespace
                    )
                    logger.debug(
                        f"Upserted batch to namespace '{namespace}': {len(batch)} vectors"
                    )
                else:
                    await asyncio.to_thread(self.index.upsert, vectors=batch)
                    logger.debug(
                        f"Upserted batch to default namespace: {len(batch)} vectors"
                    )

                logger.debug(
                    f"Upserted batch {i//batch_size + 1}: {len(batch)} vectors"
                )

        except Exception as e:
            logger.error(f"Vector batch storage failed: {e}")
            raise

    async def search(self, query: SearchQuery) -> List[SearchResult]:
        """Search for similar documents using vector similarity"""

        try:
            # Generate query embedding
            query_embedding = await asyncio.to_thread(
                self.embeddings.embed_query, query.query_text
            )

            # Prepare search filters
            search_filter = self._build_search_filter(query)

            # Perform vector search with namespace
            search_results = await asyncio.to_thread(
                self.index.query,
                vector=query_embedding,
                top_k=query.top_k,
                include_metadata=query.include_metadata,
                filter=search_filter,
                namespace=query.namespace,  # Use institution-specific namespace
            )

            # Process and format results
            formatted_results = []

            for match in search_results.matches:
                # Filter by similarity threshold
                if match.score >= query.similarity_threshold:
                    result = SearchResult(
                        document_id=match.metadata.get("document_id", ""),
                        chunk_id=match.id,
                        content=match.metadata.get("content", ""),
                        similarity_score=match.score,
                        metadata=match.metadata,
                        page_number=match.metadata.get("page_number"),
                        chunk_index=match.metadata.get("chunk_index"),
                    )
                    formatted_results.append(result)

            # Update access tracking
            await self._update_access_tracking(formatted_results)

            logger.info(
                f"Search completed: query='{query.query_text[:50]}...', "
                f"results={len(formatted_results)}/{len(search_results.matches)}"
            )

            return formatted_results

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            raise

    def _build_search_filter(self, query: SearchQuery) -> Optional[Dict[str, Any]]:
        """Build Pinecone search filter from query parameters"""

        filters = {}

        # Language filter
        if query.language:
            filters["language"] = {"$eq": query.language}

        # Document type filter
        if query.document_types:
            type_values = [dt.value for dt in query.document_types]
            if len(type_values) == 1:
                filters["document_type"] = {"$eq": type_values[0]}
            else:
                filters["document_type"] = {"$in": type_values}

        # Date range filter
        if query.date_range:
            start_date, end_date = query.date_range
            filters["upload_timestamp"] = {
                "$gte": start_date.isoformat(),
                "$lte": end_date.isoformat(),
            }

        # Custom metadata filters
        if query.metadata_filter:
            filters.update(query.metadata_filter)

        return filters if filters else None

    async def _update_access_tracking(self, results: List[SearchResult]):
        """Update document access tracking"""

        try:
            document_ids = list(set(result.document_id for result in results))

            for doc_id in document_ids:
                if doc_id in self.document_metadata_cache:
                    metadata = self.document_metadata_cache[doc_id]
                    metadata.last_accessed = datetime.now(timezone.utc)
                    metadata.access_count += 1

        except Exception as e:
            logger.warning(f"Access tracking update failed: {e}")

    async def batch_ingest_documents(
        self,
        file_paths: List[str],
        metadata_list: Optional[List[Dict[str, Any]]] = None,
        max_concurrent: int = 3,
    ) -> List[Tuple[str, bool, Optional[str]]]:
        """Batch process multiple documents with concurrency control"""

        if metadata_list and len(metadata_list) != len(file_paths):
            raise ValueError("Metadata list length must match file paths length")

        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_single_document(
            file_path: str, metadata: Optional[Dict[str, Any]]
        ):
            """Process single document with semaphore"""
            async with semaphore:
                try:
                    await self.ingest_document(file_path, metadata=metadata)
                    return file_path, True, None
                except Exception as e:
                    return file_path, False, str(e)

        # Create tasks for all documents
        tasks = []
        for i, file_path in enumerate(file_paths):
            metadata = metadata_list[i] if metadata_list else None
            task = process_single_document(file_path, metadata)
            tasks.append(task)

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks)

        # Log summary
        successful = sum(1 for _, success, _ in results if success)
        failed = len(results) - successful

        logger.info(
            f"Batch ingestion completed: {successful} successful, {failed} failed, "
            f"total: {len(results)}"
        )

        return results

    async def delete_document(self, document_id: str) -> bool:
        """Delete document and all its chunks from vector database"""

        try:
            # Get all chunk IDs for the document
            search_results = await asyncio.to_thread(
                self.index.query,
                vector=[0.0] * 1536,  # Dummy vector
                top_k=10000,  # Large number to get all chunks
                include_metadata=True,
                filter={"document_id": {"$eq": document_id}},
            )

            chunk_ids = [match.id for match in search_results.matches]

            if not chunk_ids:
                logger.warning(f"No chunks found for document: {document_id}")
                return False

            # Delete chunks in batches
            batch_size = 1000  # Pinecone delete batch size

            for i in range(0, len(chunk_ids), batch_size):
                batch_ids = chunk_ids[i : i + batch_size]
                await asyncio.to_thread(self.index.delete, ids=batch_ids)

            # Update metadata cache
            if document_id in self.document_metadata_cache:
                self.document_metadata_cache[document_id].processing_status = (
                    ProcessingStatus.DELETED
                )

            logger.info(f"Document deleted: {document_id}, chunks: {len(chunk_ids)}")
            return True

        except Exception as e:
            logger.error(f"Document deletion failed: {e}")
            return False

    async def update_document(
        self,
        document_id: str,
        file_path: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> DocumentMetadata:
        """Update existing document (delete old version and add new)"""

        try:
            # Delete old version
            await self.delete_document(document_id)

            # Increment version if updating existing document
            version = 1
            if document_id in self.document_metadata_cache:
                old_metadata = self.document_metadata_cache[document_id]
                version = old_metadata.version + 1

            # Add version to metadata
            if not metadata:
                metadata = {}
            metadata["version"] = version

            # Ingest new version
            new_metadata = await self.ingest_document(file_path, document_id, metadata)

            logger.info(f"Document updated: {document_id}, version: {version}")
            return new_metadata

        except Exception as e:
            logger.error(f"Document update failed: {e}")
            raise

    async def get_document_metadata(
        self, document_id: str
    ) -> Optional[DocumentMetadata]:
        """Get document metadata by ID"""

        # Check cache first
        if document_id in self.document_metadata_cache:
            return self.document_metadata_cache[document_id]

        # Try to reconstruct from Pinecone metadata
        try:
            search_results = await asyncio.to_thread(
                self.index.query,
                vector=[0.0] * 1536,  # Dummy vector
                top_k=1,
                include_metadata=True,
                filter={"document_id": {"$eq": document_id}},
            )

            if search_results.matches:
                match = search_results.matches[0]
                metadata = match.metadata

                # Reconstruct DocumentMetadata
                doc_metadata = DocumentMetadata(
                    document_id=document_id,
                    filename=metadata.get("filename", ""),
                    file_path="",  # Not stored in Pinecone
                    document_type=DocumentType(metadata.get("document_type", "txt")),
                    file_size=0,  # Not stored in Pinecone
                    upload_timestamp=datetime.fromisoformat(
                        metadata.get(
                            "upload_timestamp", datetime.now(timezone.utc).isoformat()
                        )
                    ),
                    processing_status=ProcessingStatus.COMPLETED,
                    version=metadata.get("version", 1),
                    title=metadata.get("title"),
                    author=metadata.get("author"),
                    language=metadata.get("language", "id"),
                    topics=(
                        metadata.get("topics", "").split(",")
                        if metadata.get("topics")
                        else []
                    ),
                )

                # Cache it
                self.document_metadata_cache[document_id] = doc_metadata
                return doc_metadata

            return None

        except Exception as e:
            logger.error(f"Failed to get document metadata: {e}")
            return None

    async def list_documents(
        self,
        limit: int = 100,
        offset: int = 0,
        status_filter: Optional[ProcessingStatus] = None,
    ) -> List[DocumentMetadata]:
        """List all documents with optional filtering"""

        # For now, return from cache
        # In production, you'd want to store metadata in a separate database
        documents = list(self.document_metadata_cache.values())

        # Apply status filter
        if status_filter:
            documents = [
                doc for doc in documents if doc.processing_status == status_filter
            ]

        # Apply pagination
        start = offset
        end = offset + limit

        return documents[start:end]

    async def get_index_stats(self) -> Dict[str, Any]:
        """Get Pinecone index statistics"""

        try:
            stats = await asyncio.to_thread(self.index.describe_index_stats)

            return {
                "total_vector_count": stats.total_vector_count,
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "namespaces": dict(stats.namespaces) if stats.namespaces else {},
            }

        except Exception as e:
            logger.error(f"Failed to get index stats: {e}")
            return {}

    async def optimize_index(self) -> bool:
        """Optimize index performance (if needed)"""

        try:
            # Pinecone is automatically optimized, but we can perform maintenance tasks
            stats = await self.get_index_stats()

            # Log current stats
            logger.info(f"Index optimization check: {stats}")

            # Could implement cleanup of old document versions here
            # For now, just return success
            return True

        except Exception as e:
            logger.error(f"Index optimization failed: {e}")
            return False


# Global service instance
_pinecone_service: Optional[PineconeVectorService] = None


def get_pinecone_service() -> PineconeVectorService:
    """Get or create Pinecone service instance"""
    global _pinecone_service
    if _pinecone_service is None:
        _pinecone_service = PineconeVectorService()
    return _pinecone_service


# Convenience functions for easier integration
async def ingest_document_simple(
    file_path: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    topics: Optional[List[str]] = None,
) -> str:
    """Simple interface for document ingestion"""

    service = get_pinecone_service()

    metadata = {}
    if title:
        metadata["title"] = title
    if description:
        metadata["description"] = description
    if topics:
        metadata["topics"] = topics

    result = await service.ingest_document(file_path, metadata=metadata)
    return result.document_id


async def search_documents_simple(
    query: str, language: str = "id", top_k: int = 5, similarity_threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """Simple interface for document search"""

    service = get_pinecone_service()

    search_query = SearchQuery(
        query_text=query,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
        language=language,
    )

    results = await service.search(search_query)
    return [result.to_dict() for result in results]


async def delete_document_simple(document_id: str) -> bool:
    """Simple interface for document deletion"""

    service = get_pinecone_service()
    return await service.delete_document(document_id)
