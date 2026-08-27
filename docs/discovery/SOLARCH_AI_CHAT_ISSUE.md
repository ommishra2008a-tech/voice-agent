# Investigation Report: Solarch Native AI Chat Endpoint

**Date:** 2026-08-23  
**Endpoint:** `POST /api/ai/chat`  
**Observed HTTP Status:** `500 Internal Server Error`  
**Observed Server Log:** `[ERROR] AI is not configured. Set ai.enabled=true and ai.apiKey in settings.`  
**Test Payload:**
```json
{
  "messages": [
    { "role": "user", "content": "Explain Solarch voice agent architecture in one sentence." }
  ]
}
```

---

## 1. Context & Observed Behavior

In Phase 1, `POST /api/ai/chat` was evaluated as part of exploring Solarch's built-in developer AI tools. The endpoint returned an HTTP 500 error because the internal settings table (`_settings`) did not contain an upstream LLM API key.

---

## 2. Root Cause Analysis

1. **Gateway Architecture**: Solarch's `/api/ai/chat` acts as a reverse proxy/gateway to external LLM providers (e.g. OpenAI, Anthropic).
2. **Configuration Requirement**: Even with `ai: { enabled: true }` in `solarch.config.ts`, Solarch requires `ai.apiKey` to be provisioned either through the platform admin UI or via `PATCH /api/settings`.

---

## 3. Recommended Resolution & Next Steps

1. **Decoupled AI Engine**: The Autonomous Voice AI Agent pipeline will not rely on Solarch's internal `/api/ai/chat` proxy as a single point of failure; instead, it will utilize dedicated LLM provider integrations in Python / TypeScript with explicit key management.
2. **Settings Configuration Test**: Test provisioning an API key via Solarch's `PATCH /api/settings` during the Agent phase (Phase 9) to evaluate the built-in gateway as an optional convenience layer.
