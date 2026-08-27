# Chat History Persistence & Multi-Chat Architecture

## 1. Overview
The Voice AI Chat Studio provides complete, durable conversation persistence across browser refresh, session changes, and account logins. All conversations, chat messages, and generated speech outputs are backed by **Solarch BaaS PocketBase** collections rather than volatile browser memory or temporary blob URLs.

---

## 2. Persistence Architecture & Hierarchy

```
User (userId)
 └── Project (projectId)
      └── Conversation (conversations collection)
           ├── id (Solarch Record ID)
           ├── title (Auto-generated from first prompt or user-renamed)
           ├── lastMessageAt (ISO timestamp)
           ├── archived (boolean)
           └── Generation Jobs (generation_jobs collection)
                ├── id (Job ID / Generation ID)
                ├── projectId & userId (Scoping)
                ├── voiceProfileId (Canonical Voice Profile Record ID)
                ├── text (User prompt / Synthesized text)
                ├── targetLanguage (Language code)
                ├── styleParams (JSON containing model, speed, pitch, emotion, voiceName, conversationId, expiresAt)
                ├── status (PROCESSING | COMPLETED | FAILED)
                ├── outputAssetId (Durable server file path to generated WAV)
                └── executionTimeMs & created/updated timestamps
```

---

## 3. Key Runtime Mechanisms

### 1. Robust `conversationId` Persistence in `styleParams`
To maintain full compatibility with the 12 canonical fields of `generation_jobs`, `conversationId` and `expiresAt` are reliably embedded inside `styleParams` JSON:
- `solarch.createGenerationJob` automatically merges `conversationId` and `expiresAt` into `styleParams`.
- `solarch.updateGenerationJob` preserves `conversationId` and `expiresAt` during status updates.
- `solarch.getGenerationJobsByConversation` queries records by `projectId` with `perPage=500` and filters by matching `conversationId` in both top-level and `styleParams`.

### 2. Recent Chats Sidebar & Navigation
- **`[+ New Chat]`**: Creates a real record in the `conversations` collection in Solarch and assigns an isolated conversation ID.
- **Auto-Naming**: The first user prompt in a `"New Conversation"` automatically updates the title in Solarch.
- **Date Grouping**: Chats are dynamically categorized into **Today**, **Yesterday**, and **Older** based on real timestamps.
- **Inline Rename & Delete**: Allows editing titles and deleting conversations with confirmation dialogs.

### 3. Session & Refresh Recovery
On application mount / reload:
1. `Dashboard` loads or creates the default project and initializes `VoiceChatStudio`.
2. `VoiceChatStudio` queries `solarch.getConversations(projectId)`.
3. Loads the active conversation or defaults to the most recent one.
4. Queries `solarch.getGenerationJobsByConversation(conversationId, projectId)` and reconstructs the exact message sequence:
   - User message bubbles (`user_${job.id}`)
   - AI Generated audio cards (`ai_${job.id}`) with durable streaming URLs:
     `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(outputAssetId)}`
   - Sets the active audio monitor to the last generated speech response.

---

## 4. Verified Acceptance Criteria

| Check | Scenario | Verification Result |
| :--- | :--- | :--- |
| **TEST A** | New Chat $\to$ Send prompt $\to$ Audio generated | **PASS** (Saved as "Hello from Chat A", 3.2s audio) |
| **TEST B** | New Chat $\to$ Send prompt $\to$ Audio generated | **PASS** (Saved as "This is Chat B", 1.5s audio) |
| **TEST C** | Click Chat A in sidebar | **PASS** (Only Chat A messages and audio card visible) |
| **TEST D** | Click Chat B in sidebar | **PASS** (Only Chat B messages and audio card visible) |
| **TEST E** | Refresh browser (`http://localhost:3000`) | **PASS** (Both chats persist in sidebar) |
| **TEST F** | Reopen / Reload session | **PASS** (Recent chats list and historical messages restored) |
| **TEST G** | Audio playback on restored cards | **PASS** (Durable streaming endpoint operational) |
