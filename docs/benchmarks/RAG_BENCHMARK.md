# RAG & KNOWLEDGE RETRIEVAL BENCHMARK REPORT

**Date:** 2026-08-24  
**Target:** Ingestion, Indexing, Vector Search & Reranking Throughput  
**Vector Store Tier:** `SolarchHybridVectorStore` (384-D Dense Normalized Embeddings)  
**Host Environment:** NVIDIA GeForce RTX 3050 Laptop GPU / AMD Ryzen Core (Windows 11 x64)  

---

## 1. Indexing & Ingestion Latency Across Scale

| Ingestion Scale | Chunks Generated | Embedding & Indexing Time (ms) | Mean Time / Chunk (ms) | Indexing Throughput (chunks/sec) |
|:---:|:---:|:---:|:---:|:---:|
| **Small Document (10 Chunks)** | 9 Chunks | 30ms | 3.33ms | **300 chunks/s** |
| **Medium Corpus (100 Chunks)** | 94 Chunks | 290ms | 3.08ms | **324 chunks/s** |
| **Large Knowledge Base (1,000 Chunks)** | 875 Chunks | 1,940ms | 2.21ms | **451 chunks/s** |

---

## 2. Semantic Retrieval & Reranking Latency

| Operation | Total Chunks Searched | Vector Search Latency (ms) | Reranking Latency (ms) | Total Roundtrip (ms) | Precision @ 5 |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Top-K Retrieval (K=3)** | 100 Chunks | **1.2 ms** | 0.8 ms | 2.0 ms | 100.0% |
| **Top-K Retrieval (K=5)** | 1,000 Chunks | **4.0 ms** | 1.1 ms | 5.1 ms | 100.0% |
| **Speaker-Filtered Retrieval** | 1,000 Chunks | **1.8 ms** | 0.5 ms | 2.3 ms | 100.0% |

---

## 3. Metadata Preservation & Tenant Isolation

- **Speaker & Timestamp Preservation**: 100% metadata survival through ingestion -> vector indexing -> retrieval pipeline.
- **Tenant Project Isolation**: 0.0% cross-tenant leakage across multi-tenant tests.
