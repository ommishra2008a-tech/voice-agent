import time
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from app.contracts.rag import (
    DocumentChunk,
    RAGIngestRequest,
    RAGIngestResponse,
    RAGRetrieveRequest,
    RAGRetrieveResponse,
    RAGRerankRequest,
    RAGRerankResponse,
    RAGContextRequest,
    RAGContextResponse
)
from app.providers.rag_engine import (
    TextEmbeddingProvider,
    vector_store,
    retriever,
    RAGReranker,
    ContextBuilder
)

router = APIRouter(prefix="/v1/rag", tags=["RAG & Knowledge Pipeline"])


@router.post("/embed")
def embed_text(text: str):
    start_time = time.time()
    vec = TextEmbeddingProvider.embed_text(text)
    return {
        "text": text,
        "embedding": vec,
        "dimension": len(vec),
        "execution_time_ms": int((time.time() - start_time) * 1000)
    }


@router.post("/ingest", response_model=RAGIngestResponse)
def ingest_document(req: RAGIngestRequest):
    start_time = time.time()
    doc_id = req.document_id or f"doc_{int(time.time() * 1000)}"

    chunks: List[DocumentChunk] = []

    # Handle transcript segments if provided (preserving speaker and timestamps)
    if req.transcript_segments and len(req.transcript_segments) > 0:
        for idx, seg in enumerate(req.transcript_segments):
            chunk_obj = DocumentChunk(
                chunk_id=f"{doc_id}_chunk_{idx}",
                document_id=doc_id,
                project_id=req.project_id,
                user_id=req.user_id,
                chunk_index=idx,
                text=seg.get("text", ""),
                speaker_id=seg.get("speaker_id") or seg.get("speaker"),
                start_time=seg.get("start_time"),
                end_time=seg.get("end_time"),
                metadata={"source_type": "transcript", "confidence": seg.get("confidence", 1.0)}
            )
            chunks.append(chunk_obj)
    else:
        # Standard text chunking with overlap
        text = req.content.strip()
        words = text.split()
        chunk_words = req.chunk_size // 5  # approx 5 chars/word
        overlap_words = req.chunk_overlap // 5

        i = 0
        chunk_idx = 0
        while i < len(words):
            chunk_slice = words[i:i + chunk_words]
            chunk_text = " ".join(chunk_slice)
            chunk_obj = DocumentChunk(
                chunk_id=f"{doc_id}_chunk_{chunk_idx}",
                document_id=doc_id,
                project_id=req.project_id,
                user_id=req.user_id,
                chunk_index=chunk_idx,
                text=chunk_text,
                metadata={"source_type": req.source_type, "title": req.title}
            )
            chunks.append(chunk_obj)
            chunk_idx += 1
            i += max(1, chunk_words - overlap_words)

    # Embed and index every chunk
    for chunk in chunks:
        emb = TextEmbeddingProvider.embed_text(chunk.text)
        vector_store.insert(chunk, emb)

    exec_time = int((time.time() - start_time) * 1000)

    return RAGIngestResponse(
        document_id=doc_id,
        project_id=req.project_id,
        title=req.title,
        chunks_count=len(chunks),
        dimension=TextEmbeddingProvider.DIMENSION,
        indexing_status="INDEXED",
        execution_time_ms=exec_time
    )


@router.post("/retrieve", response_model=RAGRetrieveResponse)
def retrieve_knowledge(req: RAGRetrieveRequest):
    return retriever.retrieve(req)


@router.post("/rerank", response_model=RAGRerankResponse)
def rerank_knowledge(req: RAGRerankRequest):
    return RAGReranker.rerank(req)


@router.post("/context", response_model=RAGContextResponse)
def build_agent_context(req: RAGContextRequest):
    return ContextBuilder.build_context(req, retriever)


@router.get("/health")
def rag_health():
    return {
        "status": "healthy",
        "vector_store": "SolarchHybridVectorStore",
        "embedding_model": "dense-semantic-384d",
        "embedding_dimension": TextEmbeddingProvider.DIMENSION,
        "total_indexed_chunks": vector_store.count()
    }
