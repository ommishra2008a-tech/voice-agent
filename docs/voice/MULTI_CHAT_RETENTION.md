# Multi-Chat History & Durable Audio Retention Architecture (Phase 13B)

## 1. Overview

Phase 13B introduces full multi-conversation management, strict chat message isolation, and durable 30-day audio retention to the Voice AI Chat Studio.

---

## 2. Core Hierarchy & Isolation Rules

```
User (userId)
 └── Project (projectId)
      └── Conversation (conversationId)
           ├── Title / LastMessageAt / Created / Updated
           └── Generation Jobs / Messages (generationJobId)
                ├── Text (Prompt / Synthesis Target)
                ├── Voice Profile (voiceProfileId)
                ├── Output Asset (outputAssetId)
                ├── Audio URL & Duration
                └── 30-Day Retention (expiresAt: createdAt + 30 days)
```

- **Strict Isolation**: Switching between conversations loads only messages linked to the active `conversationId`. Chats never mix messages, audio cards, or transcripts.
- **Project Isolation**: All queries enforce `projectId` and `userId` scoping.

---

## 3. Recent Chats Sidebar UX

- **`[+ New Chat]` Button**: Creates a new conversation in Solarch BaaS PocketBase, assigns a new conversation ID, and resets the composer/feed to a clean initial state while preserving all previous chats in the list.
- **Auto-Naming**: The first message sent in a new conversation automatically names the chat using the user's prompt text (e.g., `"Welcome to the presentation"`).
- **Date Grouping**: Conversations are dynamically grouped into:
  - **Today**
  - **Yesterday**
  - **Older**
- **Search Bar**: Real-time filtering by conversation title or prompt text.
- **Hover Actions**:
  - **Inline Rename**: Click the pencil icon to rename the chat inline.
  - **Delete with Confirmation**: Click the trash icon to open an inline delete confirmation dialog. Deleting the active chat smoothly switches to the next conversation or creates a new one.

---

## 4. 30-Day Durable Audio Retention Policy

### Generated Chat Audio vs. Saved Voice Profiles
| Asset Type | Storage Location | Retention Policy | Expiry Action |
| :--- | :--- | :--- | :--- |
| **Generated Chat Audio** | `storage/generated_audio/` | **30 Days** (`expiresAt = createdAt + 30d`) | Displays `"Audio expired (30-day retention passed)"` with metadata preserved |
| **Saved Voice Profiles** | `storage/reference_audio/` | **Permanent / Non-Expiring** | Never expired or purged by chat retention rules |

### Expired Audio Fallback
When a generated audio file reaches its 30-day expiration or the local file is removed:
- The UI retains the full card metadata: prompt text, voice profile name, timestamp, model, and generation ID.
- Replaces the audio player with an `"Audio expired (30-day retention passed)"` notice.

---

## 5. Automated Verification Results

| Test ID | Description | Result |
| :--- | :--- | :--- |
| `TEST-13B-01` | Voice Profile creation and persistence in Solarch | **PASS** |
| `TEST-13B-02` | Created Conversation A & attached durable speech | **PASS** |
| `TEST-13B-03` | Created Conversation B (New Chat) & attached durable speech | **PASS** |
| `TEST-13B-04` | Strict Conversation Isolation (no message or audio mixing) | **PASS** |
| `TEST-13B-05` | 30-Day Retention verification (`expiresAt = created + 30d`) | **PASS** |
| `TEST-13B-06` | Voice Profile reference audio is non-expiring & protected | **PASS** |
| `TEST-13B-07` | Conversation renamed successfully with real-time sync | **PASS** |
