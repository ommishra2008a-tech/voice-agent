"""
Versioned Data Contracts for RAG & Knowledge Pipeline
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    project_id: str
    user_id: str
    chunk_index: int
    text: str
    speaker_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RAGIngestRequest(BaseModel):
    project_id: str
    user_id: str
    document_id: Optional[str] = None
    title: str
    source_type: str = "text"  # "text" | "transcript" | "script" | "technical_doc"
    content: str
    transcript_segments: Optional[List[Dict[str, Any]]] = None
    chunk_size: int = 250  # Characters / tokens
    chunk_overlap: int = 40


class RAGIngestResponse(BaseModel):
    document_id: str
    project_id: str
    title: str
    chunks_count: int
    dimension: int
    indexing_status: str  # "INDEXED" | "FAILED"
    execution_time_ms: int
    error: Optional[str] = None


class RAGRetrieveRequest(BaseModel):
    project_id: str
    user_id: str
    query: str
    top_k: int = 5
    speaker_filter: Optional[str] = None
    document_id_filter: Optional[str] = None
    min_similarity: float = 0.0


class RetrievedChunk(BaseModel):
    chunk_id: str
    document_id: str
    project_id: str
    text: str
    similarity_score: float
    speaker_id: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    citation: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RAGRetrieveResponse(BaseModel):
    query: str
    project_id: str
    results_count: int
    results: List[RetrievedChunk]
    execution_time_ms: int


class RAGRerankRequest(BaseModel):
    query: str
    candidates: List[RetrievedChunk]
    top_n: int = 3


class RAGRerankResponse(BaseModel):
    query: str
    reranked_results: List[RetrievedChunk]
    execution_time_ms: int


class RAGContextRequest(BaseModel):
    project_id: str
    user_id: str
    query: str
    top_k: int = 5
    max_tokens: int = 1500


class RAGContextResponse(BaseModel):
    query: str
    formatted_context: str
    sources_cited: List[str]
    chunks_used: int
    execution_time_ms: int
