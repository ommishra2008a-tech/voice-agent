# Investigation Report: Solarch Native Vector Search Endpoint

**Date:** 2026-08-23  
**Endpoint:** `POST /api/collections/:c/vector-search`  
**Observed HTTP Status:** `404 Not Found`  
**Test Payload:**
```json
{
  "vector": [0.12, 0.22, 0.88, 0.39, 0.48],
  "topK": 2
}
```

---

## 1. Context & Observed Behavior

During Phase 1 integration testing of Solarch v0.20.3, the REST route catalog listed `POST /api/collections/:c/vector-search` as an available endpoint. However, invoking this endpoint on the SQLite-backed `vectors` collection resulted in an HTTP 404 response.

---

## 2. Root Cause Analysis

1. **Database Engine Dependency**: Solarch's vector similarity compute is designed around PostgreSQL with `pgvector` or a specialized native C-extension. The embedded `better-sqlite3` driver in local SQLite mode does not compile with dynamic vector distance modules by default.
2. **Collection Routing**: The generic router serves `/api/collections/:c/records`, but the subpath `/vector-search` delegates to a vector-index provider which is deactivated when `database.type: 'sqlite'`.

---

## 3. Recommended Resolution & Next Steps

1. **Hybrid Architecture Adopted**: Store vector metadata, transcripts, and document chunk references inside Solarch collections, and perform high-dimensional similarity retrieval in the Python AI Service / Qdrant engine.
2. **PostgreSQL Migration Track**: In later platform stages (Phase 11/12), test `solarch db provision` with a PostgreSQL/pgvector backend to evaluate native vector search performance when supported.
