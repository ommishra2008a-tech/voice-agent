# Solarch AI SDK Capability Matrix & Boundary Evaluation

**Version**: Solarch BaaS v0.20.3  
**Date**: 2026-08-24  
**Status**: Verified via Live Inspection & Source Analysis  

---

## 1. Executive Summary

A thorough investigation of the globally installed `solarch` v0.20.3 package was conducted by analyzing `dist/ai/provider.js`, `dist/ai/service.js`, and `dist/apis/ai.js`.

The Solarch AI capability is an **application-level LLM orchestration layer** integrated into the Solarch BaaS core. It connects Solarch to upstream LLM providers (OpenAI, Anthropic, Ollama, OpenRouter) and exposes administrative endpoints for schema generation, rule generation, mock data seeding, and administrative chat.

It does **not** provide native neural speech synthesis (TTS), speech-to-text (STT), speaker diarization, DSP acoustic feature extraction, or local dense vector embeddings. Consequently, the architecture strictly assigns **Application & LLM Reasoning to Solarch / TypeScript** and **Specialized Neural Audio & ML Execution to Python / PyTorch**.

---

## 2. Real Installed Exports & Capabilities

### 2.1 LLM Providers (`dist/ai/provider.d.ts`)
Solarch implements the `LLMProvider` interface with the following concrete adapters:
- `OpenAIProvider`: Direct REST completion and async streaming generator (`stream(messages)`) using OpenAI API specs.
- `AnthropicProvider`: Anthropic Messages API completion.
- `OllamaProvider`: Local Ollama instance completion via custom `baseURL`.
- `createLLMProvider(config: AIConfig)`: Factory function returning an instantiated provider based on configuration.

### 2.2 AI Service (`dist/ai/service.d.ts`)
The `AIService` class wraps the configured `LLMProvider` and executes structured domain tasks:
1. `generateCollection(description: string, options?: { dryRun?: boolean })`: Converts natural language table requirements into a Solarch collection schema JSON.
2. `generateRule(action: string, description: string)`: Generates security filter expressions for `listRule`, `viewRule`, `createRule`, `updateRule`.
3. `seedRecords(collectionName: string, count: number, constraints?: string)`: Synthesizes valid mock records conforming to collection schema fields.
4. `chat(clientMessages: LLMMessage[], context?: { collections?: string[] })`: Multi-turn conversational chat with automatic Solarch collection metadata injection.

### 2.3 HTTP API Endpoints (`dist/apis/ai.js`)
All AI endpoints are registered under `/api/ai/*` and require **Superuser (Admin) Authentication** (`requireSuperuserAuth(app)`):
- `POST /api/ai/generate-collection`: Generates and optionally applies collection schemas.
- `POST /api/ai/generate-rule`: Generates access control rules.
- `POST /api/ai/seed`: Seeds mock records into target collection.
- `POST /api/ai/test`: Verifies connectivity to configured LLM provider.
- `POST /api/ai/chat`: Executes chat completion (Max 50 messages, 10,000 chars per message, 64,000 aggregate characters).

---

## 3. Solarch AI SDK vs. Specialized Python AI Decision Matrix

| Capability Area | Provider | Implementation Mechanism | Rationale |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | **Solarch Core** | JWT + PBKDF2 Auth Collections (`users`, `admins`) | Native BaaS capability; zero external dependencies. |
| **Database & Metadata** | **Solarch Core** | SQLite WAL + Schema Collections (`projects`, `voice_profiles`, `generation_jobs`) | Native persistence with sub-millisecond query latency. |
| **Job State Tracking** | **Solarch Core** | State Machine Collections (`*_jobs`) + SSE Live Updates | Native realtime synchronization. |
| **File / Media Storage** | **Solarch Core** | Local Disk Storage (`/api/files/:collection/:id/:file`) | Native file upload & serving. |
| **Admin AI & Schema Gen** | **Solarch AI SDK** | `AIService.generateCollection()`, `AIService.generateRule()` | Native Solarch AI capability. |
| **Future Agent Reasoning** | **Solarch AI SDK / TS** | `AIService.chat()` / `OpenAIProvider` / `OllamaProvider` | Native LLM connection managed by TypeScript. |
| **Speech Recognition (STT)** | **Python AI Service** | Faster-Whisper (CTranslate2 + Silero VAD) | Requires specialized CUDA C++ / PyTorch execution. |
| **Speaker Diarization** | **Python AI Service** | Acoustic Clustering Diarization (SciPy + Scikit-Learn) | Specialized DSP signal processing. |
| **Voice Feature Profiling** | **Python AI Service** | Multi-dimensional F0, Timbre MFCC, Prosody, SNR Quality Gate | Requires NumPy, SciPy, Librosa audio DSP pipelines. |
| **Voice Synthesis (TTS)** | **Python AI Service** | FastPitch, Coqui XTTS v2, OpenVoice v2, CosyVoice | Requires PyTorch CUDA GPU inference & VRAM management. |
| **Neural Translation** | **Python AI Service** | Local NLLB-200 / MarianMT fallback with glossary support | Specialized local neural sequence-to-sequence model. |
| **Dense Vector Retrieval** | **Python AI Service** | 384-D PyTorch CUDA Cosine Search with Solarch Metadata | Solarch native vector search returns 404 in v0.20.3. |

---

## 4. Architecture Implementation Rule

1. **Always Solarch First**: For any feature involving state, persistence, authentication, authorization, realtime notifications, file storage, or high-level LLM reasoning, use Solarch.
2. **Specialized Python for Heavy ML**: Python is strictly an ML inference worker communicating over REST JSON boundaries with no direct database ownership.
3. **Future Agent in TypeScript**: The future Autonomous Agent will be implemented in TypeScript and will invoke the Solarch AI SDK for reasoning, calling deterministic Voice AI services via tool routers.
