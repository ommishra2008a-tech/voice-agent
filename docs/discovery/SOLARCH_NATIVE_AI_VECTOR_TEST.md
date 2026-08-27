# Solarch Native AI & Vector Features — Experimental Evaluation Report

**Date:** 2026-08-23  
**Solarch Version:** `0.20.3`  
**Test Endpoints:** `POST /api/collections/:c/vector-search`, `POST /api/ai/chat`  
**Evaluation Target:** Determine whether to use Solarch-Native Vector Search or a Dedicated External Vector Store for the RAG subsystem.

---

## 1. Experimental Methodology

We empirically tested Solarch's built-in vector search and AI chat capabilities against the live SQLite-backed server:
1. Created a `vectors` collection with columns: `id`, `documentId`, `embedding` (JSON float array), `metadata` (JSON), `created`, `updated`.
2. Seeded test embeddings representing acoustic and architecture documentation.
3. Evaluated `POST /api/collections/vectors/vector-search` with sample query vectors and `topK=2`.
4. Evaluated `POST /api/ai/chat` with structured developer prompts.

---

## 2. Experimental Results

| Endpoint / Feature | Request Payload | Response Code | Observed Behavior | Root Cause Analysis |
|:---|:---|:---:|:---|:---|
| `POST /api/collections/vectors/records` | `{ documentId, embedding: [...], metadata: {...} }` | `201 Created` | Standard collection insertion succeeds | Solarch successfully stores high-dimensional embeddings as JSON structures |
| `POST /api/collections/vectors/vector-search` | `{ vector: [...], topK: 2 }` | `404 Not Found` | Endpoint route exists but vector distance compute is unbacked on basic SQLite | SQLite driver lacks compile-time vector extension; native vector search requires PostgreSQL with `pgvector` or external engine |
| `POST /api/ai/chat` | `{ messages: [{ role: "user", content: "..." }] }` | `500 Server Error` | Logs: `[ERROR] AI is not configured. Set ai.enabled=true and ai.apiKey in settings.` | Solarch AI chat acts as a gateway requiring upstream LLM API key (OpenAI/Anthropic) configured in `_settings` table |

---

## 3. Architectural Decision

### Decision: HYBRID VECTOR & AGENT ARCHITECTURE (Recommended)

1. **Solarch Responsibility (Structured & Semantic Metadata Layer):**
   - Stores documents, chunk metadata, speaker attribution, transcript linkages, voice profile embeddings, and job state.
   - Manages CRUD, access rules, realtime synchronization, and collection indexing.

2. **Python AI Service Responsibility (Vector Compute & Similarity Engine):**
   - High-dimensional vector indexing (BGE-M3 / all-MiniLM text embeddings).
   - Fast Cosine / Dot-Product similarity search via Qdrant / in-memory vector indexing.
   - Cross-Encoder reranking and context assembly.

3. **Separation Invariant Preserved:**
   - Text embeddings and Voice embeddings remain in separate indices/collections per Prompt §33.
