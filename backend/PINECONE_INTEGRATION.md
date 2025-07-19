# Pinecone Vector Database Integration for Tunarasa RAG System

## Overview

This implementation provides a comprehensive Pinecone vector database integration for the Tunarasa RAG (Retrieval-Augmented Generation) system. It includes document ingestion, vector search, and management capabilities designed specifically for Indonesian government service documentation.

## Features

### 🔧 Core Functionality
- **Document Ingestion Pipeline**: Support for PDF, text, markdown, and JSON documents
- **Vector Search**: High-performance similarity search with metadata filtering
- **Batch Processing**: Concurrent document processing for large datasets
- **Document Management**: CRUD operations for knowledge base documents
- **Metadata Management**: Rich metadata support with versioning and topics
- **Error Handling**: Comprehensive error handling and logging
- **Performance Monitoring**: Processing time tracking and optimization

### 📚 Document Support
- **PDF**: Text extraction with page references
- **Text Files**: UTF-8 and Latin-1 encoding support
- **Markdown**: Structured text processing with header preservation
- **JSON**: Recursive text extraction from structured data

### 🔍 Search Capabilities
- **Vector Similarity**: OpenAI embeddings with cosine similarity
- **Metadata Filtering**: Filter by language, document type, topics, date range
- **Similarity Threshold**: Configurable relevance scoring
- **Multi-language**: Support for Indonesian and English content

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Endpoints                      │
│                    (/api/v1/rag/*)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                Document Manager                             │
│            (High-level orchestration)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Pinecone Vector Service                        │
│           (Core vector operations)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Document Processor                             │
│         (Text extraction & chunking)                       │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX_NAME=tunarasa-documents

# OpenAI Configuration (for embeddings)
OPENAI_API_KEY=your_openai_api_key

# RAG Configuration
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_RETRIEVAL_K=3
RAG_SIMILARITY_THRESHOLD=0.7
```

### Dependencies

The following dependencies are required (already included in requirements.txt):

```
pinecone-client==3.0.0
openai==1.6.0
langchain-openai==0.0.5
pypdf==3.17.0
aiofiles==23.2.0
```

## Usage Examples

### 1. Basic Document Ingestion

```python
from app.services.pinecone_service import get_pinecone_service

# Get service instance
service = get_pinecone_service()

# Add a document
metadata = await service.ingest_document(
    file_path="documents/government_guide.pdf",
    metadata={
        "title": "Government Services Guide",
        "description": "Comprehensive guide to Indonesian government services",
        "author": "Ministry of Interior",
        "language": "id",
        "topics": ["government", "services", "procedures"]
    }
)

print(f"Document added: {metadata.document_id}")
print(f"Chunks created: {metadata.chunk_count}")
```

### 2. Vector Search

```python
from app.services.pinecone_service import SearchQuery

# Create search query
query = SearchQuery(
    query_text="cara membuat KTP baru",
    top_k=5,
    similarity_threshold=0.7,
    language="id",
    document_types=["pdf"],
    topics=["ktp", "identitas"]
)

# Perform search
results = await service.search(query)

for result in results:
    print(f"Score: {result.similarity_score:.3f}")
    print(f"Content: {result.content[:100]}...")
    print(f"Source: {result.metadata['filename']}")
```

### 3. Batch Processing

```python
# Process multiple documents
file_paths = [
    "documents/ktp_guide.pdf",
    "documents/passport_procedures.txt",
    "documents/birth_certificate.md"
]

metadata_list = [
    {"title": "KTP Guide", "topics": ["ktp", "identity"]},
    {"title": "Passport Procedures", "topics": ["passport", "travel"]},
    {"title": "Birth Certificate", "topics": ["birth", "certificate"]}
]

results = await service.batch_ingest_documents(
    file_paths=file_paths,
    metadata_list=metadata_list,
    max_concurrent=3
)

print(f"Successfully processed: {len([r for r in results if r[1]])}")
```

### 4. High-level Document Management

```python
from app.services.document_manager import get_document_manager

manager = get_document_manager()

# Add document with manager
result = await manager.add_document(
    file_path="documents/tax_guide.pdf",
    title="Tax Registration Guide",
    description="Guide for tax registration procedures",
    topics=["tax", "registration", "business"]
)

# Search with Q&A
qa_result = await manager.search_with_qa(
    question="Bagaimana cara mendaftar NPWP?",
    session_id="user_session_123",
    language="id"
)

print(f"Answer: {qa_result['answer']}")
print(f"Confidence: {qa_result['confidence']}")
print(f"Sources: {len(qa_result['sources'])} documents")
```

## API Endpoints

### Document Management

#### Upload Document
```
POST /api/v1/rag/upload
Content-Type: multipart/form-data

Fields:
- file: Document file (PDF, TXT, MD, JSON)
- title: Document title (optional)
- description: Document description (optional)
- author: Document author (optional)
- topics: Comma-separated topics (optional)
- language: Document language (default: "id")
```

#### Get Document Status
```
GET /api/v1/rag/status/{document_id}

Response: Document processing status and metadata
```

#### List Documents
```
GET /api/v1/rag/documents?limit=50&offset=0&status_filter=completed

Response: Paginated list of documents with metadata
```

#### Delete Document
```
DELETE /api/v1/rag/documents/{document_id}

Response: Deletion confirmation
```

### Search & RAG

#### Search Documents
```
POST /api/v1/rag/search
Content-Type: application/json

{
    "query": "cara membuat KTP",
    "limit": 5,
    "similarity_threshold": 0.7,
    "language": "id",
    "document_types": ["pdf", "txt"],
    "topics": ["ktp", "identitas"]
}
```

#### Ask Question (RAG)
```
POST /api/v1/rag/ask
Content-Type: application/json

{
    "question": "Apa saja syarat membuat KTP baru?",
    "session_id": "user_123",
    "language": "id",
    "max_sources": 3,
    "similarity_threshold": 0.7
}
```

#### Knowledge Base Statistics
```
GET /api/v1/rag/stats

Response: Vector count, document statistics, type distributions
```

## Performance Optimization

### Indexing Strategy
- **Chunking**: 1000 character chunks with 200 character overlap
- **Embeddings**: OpenAI text-embedding-ada-002 (1536 dimensions)
- **Batch Size**: 25 documents per embedding batch
- **Concurrency**: Configurable concurrent processing (default: 3)

### Caching
- **Document Metadata**: Cached in memory and Redis
- **Search Results**: Session-based caching
- **Embedding Cache**: Reuse embeddings for identical content

### Monitoring
- **Processing Time**: Tracked for all operations
- **Error Rates**: Comprehensive error logging
- **Usage Metrics**: Document access tracking
- **Performance Metrics**: Response time monitoring

## Error Handling

The system includes comprehensive error handling for:

- **API Key Issues**: Invalid or missing Pinecone/OpenAI keys
- **Document Processing**: Corrupted files, unsupported formats
- **Vector Operations**: Embedding failures, index connection issues
- **Resource Limits**: File size limits, rate limiting
- **Network Issues**: Timeout handling, retry mechanisms

### Common Error Codes

```
400 Bad Request: Invalid file format or missing parameters
404 Not Found: Document not found
429 Too Many Requests: Rate limit exceeded
500 Internal Server Error: Processing or system errors
```

## Testing

### Running the Example Script

```bash
cd backend
python example_pinecone_usage.py
```

This script demonstrates:
- Basic document ingestion
- Vector search operations
- Batch processing
- High-level document management
- Knowledge base statistics

### Integration Testing

```bash
# Test document upload
curl -X POST "http://localhost:8000/api/v1/rag/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@documents/test_document.pdf" \
  -F "title=Test Document" \
  -F "topics=test,demo"

# Test document search
curl -X POST "http://localhost:8000/api/v1/rag/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test query",
    "limit": 3,
    "similarity_threshold": 0.7,
    "language": "id"
  }'

# Test Q&A
curl -X POST "http://localhost:8000/api/v1/rag/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is this document about?",
    "session_id": "test_session",
    "language": "en"
  }'
```

## Best Practices

### Document Preparation
1. **Clean Text**: Remove excessive whitespace and formatting
2. **Meaningful Titles**: Use descriptive titles for better retrieval
3. **Rich Metadata**: Include topics, authors, and descriptions
4. **Language Consistency**: Specify correct language for better search

### Search Optimization
1. **Similarity Thresholds**: Use 0.7+ for precise results, 0.5+ for broader search
2. **Query Enhancement**: Include context keywords for better matching
3. **Metadata Filtering**: Use document type and topic filters to narrow results
4. **Result Limits**: Balance completeness vs. performance (3-10 results optimal)

### Performance Tuning
1. **Batch Processing**: Use batch operations for multiple documents
2. **Concurrent Limits**: Adjust based on system resources (3-5 recommended)
3. **Chunking Strategy**: Optimize chunk size based on document types
4. **Caching**: Leverage Redis for frequently accessed data

## Troubleshooting

### Common Issues

#### 1. Pinecone Connection Errors
```
Error: Failed to initialize Pinecone client
Solution: Check PINECONE_API_KEY and PINECONE_ENVIRONMENT settings
```

#### 2. OpenAI Embedding Errors
```
Error: Failed to generate embeddings
Solution: Verify OPENAI_API_KEY and check API quota
```

#### 3. Document Processing Failures
```
Error: Document processing failed
Solution: Check file format, size, and encoding
```

#### 4. Vector Search Issues
```
Error: No results found
Solution: Lower similarity threshold, check query language, verify document indexing
```

### Debug Mode

Enable debug logging in `app/core/config.py`:

```python
DEBUG = True
```

This will provide detailed logging for:
- Document processing steps
- Vector operations
- Search queries and results
- Performance metrics

## Future Enhancements

### Planned Features
- **Hybrid Search**: Combine vector and keyword search
- **Query Expansion**: Automatic query enhancement
- **Document Clustering**: Organize documents by topics
- **Real-time Updates**: Live document synchronization
- **Advanced Analytics**: Search analytics and insights

### Performance Improvements
- **Embedding Caching**: Cache embeddings at the service level
- **Parallel Processing**: Multi-threaded document processing
- **Index Optimization**: Automatic index maintenance
- **Load Balancing**: Distribute load across multiple instances

## Support

For issues and questions:
1. Check the debug logs for detailed error information
2. Verify environment variable configuration
3. Test with example documents and queries
4. Review API response codes and messages

The Pinecone integration is designed to be robust, scalable, and production-ready for the Tunarasa RAG system.