"""
Example usage of Pinecone Vector Database Service for Tunarasa

This script demonstrates how to use the Pinecone service for document
ingestion, search, and management in the Tunarasa RAG system.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.pinecone_service import (
    get_pinecone_service,
    DocumentType,
    SearchQuery,
    ingest_document_simple,
    search_documents_simple
)
from app.services.document_manager import (
    get_document_manager,
    add_document_to_knowledge_base,
    search_knowledge_base,
    ask_question_with_sources
)
from app.core.config import settings


async def example_basic_usage():
    """Basic usage example of Pinecone service"""
    
    print("=== Basic Pinecone Service Usage ===\n")
    
    # Get service instance
    service = get_pinecone_service()
    
    # Example 1: Add a document
    print("1. Adding a document...")
    
    # Check if example document exists
    doc_path = "documents/buku-saku-dukcapil-yogya.txt"
    if os.path.exists(doc_path):
        try:
            metadata = await service.ingest_document(
                file_path=doc_path,
                metadata={
                    "title": "Buku Saku Pelayanan Dukcapil Yogyakarta",
                    "description": "Panduan layanan kependudukan dan pencatatan sipil",
                    "author": "Dinas Kependudukan Yogyakarta",
                    "language": "id",
                    "topics": ["dukcapil", "kependudukan", "pelayanan"]
                }
            )
            print(f"   ✓ Document added: {metadata.document_id}")
            print(f"   ✓ Chunks created: {metadata.chunk_count}")
            print(f"   ✓ Processing time: {metadata.processing_time:.2f}s\n")
            
            # Example 2: Search documents
            print("2. Searching documents...")
            
            search_query = SearchQuery(
                query_text="bagaimana cara membuat KTP",
                top_k=3,
                similarity_threshold=0.7,
                language="id"
            )
            
            results = await service.search(search_query)
            
            print(f"   ✓ Found {len(results)} relevant chunks")
            for i, result in enumerate(results, 1):
                print(f"   {i}. Score: {result.similarity_score:.3f}")
                print(f"      Content: {result.content[:100]}...")
                print(f"      Source: {result.metadata.get('filename', 'Unknown')}\n")
            
            # Example 3: Get document info
            print("3. Getting document information...")
            
            doc_info = await service.get_document_metadata(metadata.document_id)
            if doc_info:
                print(f"   ✓ Document ID: {doc_info.document_id}")
                print(f"   ✓ Title: {doc_info.title}")
                print(f"   ✓ Type: {doc_info.document_type.value}")
                print(f"   ✓ Status: {doc_info.processing_status.value}")
                print(f"   ✓ Chunks: {doc_info.chunk_count}\n")
            
        except Exception as e:
            print(f"   ✗ Error: {e}\n")
    else:
        print(f"   ✗ Document not found: {doc_path}\n")


async def example_document_manager():
    """Example using the high-level Document Manager"""
    
    print("=== Document Manager Usage ===\n")
    
    manager = get_document_manager()
    
    # Example 1: Add document using manager
    print("1. Adding document via Document Manager...")
    
    doc_path = "documents/buku-saku-dukcapil-yogya.txt"
    if os.path.exists(doc_path):
        try:
            result = await manager.add_document(
                file_path=doc_path,
                title="Panduan Layanan Dukcapil",
                description="Buku panduan pelayanan kependudukan",
                author="Pemda Yogyakarta",
                topics=["ktp", "akta", "kk", "dukcapil"],
                language="id"
            )
            
            if result["success"]:
                print(f"   ✓ Document added: {result['document_id']}")
                print(f"   ✓ Message: {result['message']}\n")
                
                doc_id = result['document_id']
                
                # Example 2: Search using manager
                print("2. Searching via Document Manager...")
                
                search_result = await manager.search_documents(
                    query="syarat membuat akta kelahiran",
                    language="id",
                    max_results=3,
                    topics=["akta"]
                )
                
                if search_result["success"]:
                    print(f"   ✓ Found {search_result['total_results']} results")
                    for result in search_result["results"]:
                        print(f"   - Score: {result['similarity_score']:.3f}")
                        print(f"     Title: {result['title']}")
                        print(f"     Content: {result['content'][:80]}...\n")
                
                # Example 3: Q&A with sources
                print("3. Question & Answer with sources...")
                
                qa_result = await manager.search_with_qa(
                    question="Apa saja syarat untuk membuat KTP baru?",
                    session_id="example_session_123",
                    language="id"
                )
                
                if qa_result["success"]:
                    print(f"   ✓ Question: {qa_result['question']}")
                    print(f"   ✓ Answer: {qa_result['answer'][:200]}...")
                    print(f"   ✓ Confidence: {qa_result['confidence']:.2f}")
                    print(f"   ✓ Sources: {len(qa_result['sources'])} documents")
                    if qa_result.get('follow_up_suggestions'):
                        print(f"   ✓ Follow-ups: {qa_result['follow_up_suggestions'][:2]}\n")
                
            else:
                print(f"   ✗ Failed: {result['message']}\n")
                
        except Exception as e:
            print(f"   ✗ Error: {e}\n")
    else:
        print(f"   ✗ Document not found: {doc_path}\n")


async def example_batch_processing():
    """Example of batch document processing"""
    
    print("=== Batch Processing Example ===\n")
    
    manager = get_document_manager()
    
    # Find all documents in the documents directory
    doc_dir = Path("documents")
    if doc_dir.exists():
        doc_files = []
        metadata_list = []
        
        for file_path in doc_dir.glob("*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.txt', '.pdf', '.md']:
                doc_files.append(str(file_path))
                
                # Create metadata for each file
                metadata = {
                    "title": file_path.stem.replace('-', ' ').title(),
                    "description": f"Government service document: {file_path.name}",
                    "language": "id",
                    "topics": ["government", "services", "public"]
                }
                metadata_list.append(metadata)
        
        if doc_files:
            print(f"1. Processing {len(doc_files)} documents in batch...")
            
            try:
                result = await manager.batch_add_documents(
                    file_paths=doc_files,
                    metadata_list=metadata_list,
                    max_concurrent=2  # Process 2 documents concurrently
                )
                
                if result["success"]:
                    print(f"   ✓ Successful: {result['success_count']}")
                    print(f"   ✓ Failed: {result['failure_count']}")
                    print(f"   ✓ Total: {result['total_processed']}")
                    
                    if result['failed']:
                        print("   ✗ Failed files:")
                        for failed in result['failed']:
                            print(f"     - {failed['file_path']}: {failed['error']}")
                    
                    print()
                    
                else:
                    print(f"   ✗ Batch processing failed: {result['message']}\n")
                    
            except Exception as e:
                print(f"   ✗ Error: {e}\n")
        else:
            print("   ✗ No documents found in documents/ directory\n")
    else:
        print("   ✗ Documents directory not found\n")


async def example_knowledge_base_stats():
    """Example of getting knowledge base statistics"""
    
    print("=== Knowledge Base Statistics ===\n")
    
    manager = get_document_manager()
    
    try:
        stats_result = await manager.get_knowledge_base_stats()
        
        if stats_result["success"]:
            stats = stats_result["stats"]
            
            print(f"Total Vectors: {stats['total_vectors']:,}")
            print(f"Total Documents: {stats['total_documents']}")
            print(f"Index Fullness: {stats['index_fullness']:.1%}")
            
            print("\nDocument Status Distribution:")
            for status, count in stats['status_distribution'].items():
                print(f"  {status}: {count}")
            
            print("\nDocument Type Distribution:")
            for doc_type, count in stats['type_distribution'].items():
                print(f"  {doc_type}: {count}")
            
            print("\nLanguage Distribution:")
            for language, count in stats['language_distribution'].items():
                print(f"  {language}: {count}")
            
            print()
            
        else:
            print(f"✗ Failed to get stats: {stats_result['message']}\n")
            
    except Exception as e:
        print(f"✗ Error: {e}\n")


async def example_convenience_functions():
    """Example using convenience functions"""
    
    print("=== Convenience Functions Example ===\n")
    
    doc_path = "documents/buku-saku-dukcapil-yogya.txt"
    if os.path.exists(doc_path):
        try:
            # Simple document addition
            print("1. Adding document with convenience function...")
            
            doc_id = await add_document_to_knowledge_base(
                file_path=doc_path,
                title="Government Services Guide",
                description="Comprehensive guide to government services",
                topics=["government", "services", "documentation"]
            )
            
            print(f"   ✓ Document added: {doc_id}\n")
            
            # Simple search
            print("2. Searching with convenience function...")
            
            results = await search_knowledge_base(
                query="dokumen yang diperlukan untuk pendaftaran",
                language="id",
                max_results=3
            )
            
            print(f"   ✓ Found {len(results)} results")
            for result in results:
                print(f"   - Score: {result['similarity_score']:.3f}")
                print(f"     Content: {result['content'][:80]}...\n")
            
            # Simple Q&A
            print("3. Q&A with convenience function...")
            
            qa_result = await ask_question_with_sources(
                question="Bagaimana cara mengurus surat keterangan domisili?",
                session_id="convenience_example",
                language="id"
            )
            
            print(f"   ✓ Question: {qa_result['question']}")
            print(f"   ✓ Answer: {qa_result['answer'][:150]}...")
            print(f"   ✓ Confidence: {qa_result['confidence']:.2f}")
            print(f"   ✓ Sources: {len(qa_result['sources'])} documents\n")
            
        except Exception as e:
            print(f"   ✗ Error: {e}\n")
    else:
        print(f"   ✗ Document not found: {doc_path}\n")


async def main():
    """Run all examples"""
    
    print("Pinecone Vector Database Service Examples")
    print("=" * 50)
    print()
    
    # Check configuration
    if not settings.PINECONE_API_KEY:
        print("❌ PINECONE_API_KEY not configured")
        return
    
    if not settings.OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not configured")
        return
    
    print("✅ Configuration looks good")
    print(f"✅ Pinecone Index: {settings.PINECONE_INDEX_NAME}")
    print(f"✅ Pinecone Environment: {settings.PINECONE_ENVIRONMENT}")
    print()
    
    # Run examples
    try:
        await example_basic_usage()
        await example_document_manager()
        await example_batch_processing()
        await example_knowledge_base_stats()
        await example_convenience_functions()
        
        print("🎉 All examples completed successfully!")
        
    except Exception as e:
        print(f"❌ Example execution failed: {e}")


if __name__ == "__main__":
    # Run the examples
    asyncio.run(main())