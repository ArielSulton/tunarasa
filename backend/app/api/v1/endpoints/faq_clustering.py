from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import logging
from app.services.faq_clustering_service import SimplifiedFAQClusteringService
from app.core.config import settings

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter()

class FAQClusteringRequest(BaseModel):
    questions: List[str]
    
class RepresentativeInfo(BaseModel):
    representative: str
    representative_index: int
    all_questions: List[str]
    count: int
    avg_similarity: float   
    centroid_distance: float

class FAQClusteringResponse(BaseModel):
    n_clusters: int
    clusters: List[int]
    representatives: Dict[str, RepresentativeInfo]
    keywords: Dict[str, List[str]]



@router.post("/cluster", response_model=FAQClusteringResponse)
def cluster_faq(request: FAQClusteringRequest):
    try:
        service = SimplifiedFAQClusteringService(
            pinecone_api_key=settings.PINECONE_API_KEY,
            pinecone_index_name=settings.PINECONE_INDEX_NAME,
            embedding_model=settings.EMBEDDING_MODEL
        )
        print("mulai \n"*10)
        result = service.cluster_questions(request.questions)
        
        # Debug: Print type and short content before processing
        print("Representatives before conversion:", result.get("representatives"))
        print("Keywords before conversion:", result.get("keywords"))
        
        # Convert keys to str for Pydantic compatibility (ensure it's a dictionary)
        if isinstance(result["representatives"], dict):
            result["representatives"] = {str(k): v for k, v in result["representatives"].items()}
        if isinstance(result["keywords"], dict):
            result["keywords"] = {str(k): v for k, v in result["keywords"].items()}
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 
