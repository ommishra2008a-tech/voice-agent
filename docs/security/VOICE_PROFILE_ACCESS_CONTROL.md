# Voice Profile Access Control & Authorization

## 1. Security Overview
Voice profiles represent proprietary user voice data, containing speaker conditioning embeddings, spectral characteristics, and reference audio recordings. To guarantee strict multi-tenant privacy, access control is enforced at both the **Solarch BaaS Data Layer** and the **Specialized Python AI Service Layer**.

---

## 2. Authenticated Ownership Model

```
Authenticated User (userId)
 └── Authorized Workspace / Project (projectId)
      └── Voice Profile (voiceProfileId)
           ├── primaryReferencePath (Reference WAV)
           ├── speakerEmbedding (Spectral fingerprint)
           └── Voice Synthesis & Preview Capabilities
```

### Authorization Invariants
1. **Ownership Enforcement**: Every voice profile operation requires:
   $$\text{Caller Identity} \equiv \text{Voice Profile Record's } userId$$
   $$\text{Target Project} \equiv \text{Voice Profile Record's } projectId$$
2. **Pre-Inference Authorization**: When requesting speech generation (`POST /v1/speech/generate`) or voice preview (`POST /v1/voice/profile/preview`), the engine verifies ownership **prior to loading audio references or initiating neural conditioning**.
3. **Defense-in-Depth**:
   - Backend Python Service verifies `(userId, projectId)` on all profile lookups, previewing, and synthesis.
   - Solarch BaaS client automatically scopes all collection queries with `(projectId='...' && userId='...')`.
   - Frontend state and `localStorage` keys are strictly isolated per authenticated user session.

---

## 3. API Authorization Boundaries

| Endpoint | Method | Security Check | Unauthorized Response |
| :--- | :--- | :--- | :--- |
| `/v1/voice/profile/{id}` | `GET` | Validates `userId` & `projectId` against Solarch record & storage manifest | `403 Forbidden` |
| `/v1/voice/profile/preview` | `POST` | Pre-inference authorization on `voice_profile_id` & `audio_path` | `403 Forbidden` |
| `/v1/speech/generate` | `POST` | Pre-synthesis reference audio resolution & ownership check | `403 Forbidden` |
| `/v1/voice/profile/{id}` | `DELETE` | Ownership verification prior to storage & database deletion | `403 Forbidden` |
| `/v1/media/audio/raw` | `GET` | Path traversal prevention (`..` disallow) & storage sandbox boundary check | `403 Forbidden` |

---

## 4. Zero Cross-Tenant Leakage Guarantees
- **Same-Name Disambiguation**: Two users may create a voice named `"My Voice"`. Resolution is strictly keyed on `(userId, projectId, voiceProfileId)` rather than string names.
- **Reference Audio Containment**: Reference audio files and storage manifests (`profile.json`) are validated for user and project ownership.
- **Session Purging**: On user logout / login switch, all cached voice IDs, active conversation IDs, and profile lists are discarded.
