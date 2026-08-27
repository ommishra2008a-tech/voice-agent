# AGENT WORKFLOW BENCHMARK REPORT

**Date:** 2026-08-24  
**Target:** Multi-Workflow Autonomous Agent Orchestration Latency  
**Hardware:** NVIDIA GeForce RTX 3050 Laptop GPU (6GB VRAM, CUDA 12.1 Active)  

---

## 1. Workflow Comparative Matrix

| Workflow Scenario | Workflow Description | Tools Dispatched | Planning Latency | Tool Execution Latency | Total End-to-End Latency |
|:---|:---|:---:|:---:|:---:|:---:|
| **Workflow A** | Direct Text → Speech | 1 | < 1 ms | 59 ms | **60 ms** |
| **Workflow B** | Media URL → Transcript & Speakers | 1 | < 1 ms | 60 ms | **61 ms** |
| **Workflow C** | Sourced Knowledge RAG QA | 1 | < 1 ms | 1 ms | **1.5 ms** |
| **Workflow D** | URL → Speaker → Translation → Speech | 4 | < 1 ms | 71 ms | **72 ms** |

---

## 2. Multi-Turn Context Retention

- **Turn 1 (URL Ingestion)**: Extracts YouTube video and Speaker 2.
- **Turn 2 ("Translate it to Hindi")**: Agent resolves previous session entity bindings (`active_speaker: speaker_2`) and dispatches translation without re-prompting.
