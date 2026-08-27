# SOLARCH TRANSLATION CAPABILITY EVALUATION REPORT

**Date:** 2026-08-24  
**Solarch Version:** `v0.20.3`  
**Evaluation:** Native AI / Translation Capabilities in Solarch BaaS  

---

## 1. Discovery & Verification Findings

1. **Native Solarch Routes**:
   - Solarch v0.20.3 exposes `/api/ai/chat` as a proxy wrapper requiring an upstream commercial LLM API key configured in `solarch.config.ts`.
   - Solarch does not provide a dedicated local neural translation endpoint or language detection pipeline out-of-the-box.
2. **Architectural Decision**:
   - **Solarch BaaS Role**: Stores and manages `translation_jobs`, project terminology glossaries, translated transcripts, and asset metadata with SSE event streaming.
   - **Python AI Service Role**: Implements the `TranslationProvider` abstraction (`LocalNeuralTranslationProvider` / `NLLBAdapter` / `GoogleTranslateAdapter`) supporting bidirectional English ↔ Hindi, language detection, RAG terminology groundings, and direct linkage to the `VoiceEngine`.
