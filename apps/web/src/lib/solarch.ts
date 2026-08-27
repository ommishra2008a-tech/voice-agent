/**
 * Solarch Web Client Integration Layer
 * Connects to the local Solarch BaaS instance on port 8090
 * Supports Collections, Jobs State Machines, SSE Realtime, and Solarch AI SDK
 */
export const SOLARCH_API_URL = process.env.NEXT_PUBLIC_SOLARCH_URL || "http://localhost:8090";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  settings?: any;
  created: string;
  updated: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface VoiceProfileRecord {
  id?: string;
  projectId: string;
  userId: string;
  name: string;
  speakerId: string;
  speakerEmbedding: number[];
  sourceAssetId?: string;
  voiceProfileId?: string;
  referenceAudio?: string;
  timbreCharacteristics?: any;
  pitchStats?: any;
  prosodyProfile?: any;
  styleProfile?: any;
  emotionProfile?: any;
  qualityScore?: number;
  qualityGatePassed?: boolean;
  readinessState?: "TEMPORARY" | "ANALYZING" | "PREVIEW_READY" | "READY" | "READY_WITH_LIMITATIONS" | "FAILED";
  profileVersion?: string;
  encoderVersion?: string;
  analysisVersion?: string;
  referenceAudioPaths?: string[];
  primaryReferencePath?: string;
  previewAudioUrl?: string;
  supportedEngines?: string[];
  samplesDetails?: any[];
  rejectionReason?: string;
  language?: string;
  created?: string;
  updated?: string;
}



export interface ConversationRecord {
  id?: string;
  projectId: string;
  userId: string;
  title: string;
  lastMessageAt?: string;
  archived?: boolean;
  metadata?: any;
  created?: string;
  updated?: string;
}

export interface GenerationJobRecord {
  id?: string;
  projectId: string;
  userId: string;
  conversationId?: string;
  voiceProfileId: string;
  text: string;
  targetLanguage?: string;
  styleParams?: any;
  emotionParam?: string;
  status: "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  outputAssetId?: string;
  expiresAt?: string;
  error?: string;
  executionTimeMs?: number;
  audioUrl?: string;
  created?: string;
  updated?: string;
}

export class SolarchService {
  private baseUrl: string;
  private token: string | null = null;
  private currentUser: User | null = null;

  constructor(baseUrl: string = SOLARCH_API_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("solarch_token");
      const userStr = localStorage.getItem("solarch_user");
      if (userStr) {
        try { this.currentUser = JSON.parse(userStr); } catch(e) {}
      }
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as any || {})
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  }

  async signup(email: string, password: string, name: string): Promise<{ token: string; user: User }> {
    const data = await this.request("/api/collections/users/records", {
      method: "POST",
      body: JSON.stringify({ email, password, passwordConfirm: password, name })
    });
    this.token = data.token;
    this.currentUser = { id: data.record.id, email: data.record.email, name: data.record.name };
    if (typeof window !== "undefined") {
      localStorage.setItem("solarch_token", this.token!);
      localStorage.setItem("solarch_user", JSON.stringify(this.currentUser));
    }
    return { token: this.token!, user: this.currentUser };
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await this.request("/api/collections/users/auth-with-password", {
      method: "POST",
      body: JSON.stringify({ identity: email, password })
    });
    this.token = data.token;
    this.currentUser = { id: data.record.id, email: data.record.email, name: data.record.name };
    if (typeof window !== "undefined") {
      localStorage.setItem("solarch_token", this.token!);
      localStorage.setItem("solarch_user", JSON.stringify(this.currentUser));
    }
    return { token: this.token!, user: this.currentUser };
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("solarch_token");
      localStorage.removeItem("solarch_user");
    }
  }

  // --- Projects ---
  async getProjects(userIdOverride?: string): Promise<Project[]> {
    const userId = userIdOverride || this.currentUser?.id;
    if (!userId) return [];
    try {
      const filter = encodeURIComponent(`(userId='${userId}')`);
      const data = await this.request(`/api/collections/projects/records?filter=${filter}&sort=-created`);
      const items = data.items || [];
      return items.filter((p: any) => p.userId === userId);
    } catch {
      return [];
    }
  }

  async createProject(name: string, description: string): Promise<Project> {
    if (!this.currentUser) throw new Error("Must be logged in to create a project.");
    return await this.request("/api/collections/projects/records", {
      method: "POST",
      body: JSON.stringify({
        userId: this.currentUser.id,
        name,
        description,
        settings: { defaultEngine: "FastPitchBaseline", defaultSampleRate: 24000 }
      })
    });
  }

  async updateProject(projectId: string, data: Partial<Project>): Promise<Project> {
    return await this.request(`/api/collections/projects/records/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  }


  // --- Voice Profiles ---
  async getVoiceProfiles(projectId: string, userIdOverride?: string): Promise<VoiceProfileRecord[]> {
    const userId = userIdOverride || this.currentUser?.id;
    if (!userId || !projectId) return [];
    try {
      const filter = encodeURIComponent(`(projectId='${projectId}' && userId='${userId}')`);
      const data = await this.request(`/api/collections/voice_profiles/records?filter=${filter}&sort=-created`);
      const items = data.items || [];
      return items
        .filter((item: any) => item.userId === userId && item.projectId === projectId)
        .map((item: any) => ({
          ...item,
          primaryReferencePath: item.primaryReferencePath || item.referenceAudio || undefined,
          referenceAudio: item.referenceAudio || item.primaryReferencePath || undefined,
          voiceProfileId: item.voiceProfileId || item.sourceAssetId || item.id,
          sourceAssetId: item.sourceAssetId || item.voiceProfileId || item.id,
          referenceAudioPaths: item.referenceAudioPaths || (item.referenceAudio ? [item.referenceAudio] : (item.primaryReferencePath ? [item.primaryReferencePath] : []))
        }));
    } catch {
      return [];
    }
  }

  async getVoiceProfileById(id: string, projectId?: string, userIdOverride?: string): Promise<VoiceProfileRecord | null> {
    const userId = userIdOverride || this.currentUser?.id;
    try {
      const item = await this.request(`/api/collections/voice_profiles/records/${id}`);
      if (!item) return null;
      if (userId && item.userId && item.userId !== userId) {
        console.warn("[Solarch] Security violation: Attempted cross-user voice profile access denied.");
        return null;
      }
      if (projectId && item.projectId && item.projectId !== projectId) {
        console.warn("[Solarch] Security violation: Attempted cross-project voice profile access denied.");
        return null;
      }
      return {
        ...item,
        primaryReferencePath: item.primaryReferencePath || item.referenceAudio || undefined,
        referenceAudio: item.referenceAudio || item.primaryReferencePath || undefined,
        voiceProfileId: item.voiceProfileId || item.sourceAssetId || item.id,
        sourceAssetId: item.sourceAssetId || item.voiceProfileId || item.id,
        referenceAudioPaths: item.referenceAudioPaths || (item.referenceAudio ? [item.referenceAudio] : (item.primaryReferencePath ? [item.primaryReferencePath] : []))
      };
    } catch {
      return null;
    }
  }

  async createVoiceProfile(profile: VoiceProfileRecord): Promise<any> {
    const userId = this.currentUser?.id || profile.userId;
    const payload = {
      ...profile,
      userId,
      referenceAudio: profile.primaryReferencePath || profile.referenceAudio || undefined,
      sourceAssetId: profile.voiceProfileId || profile.sourceAssetId || profile.id || undefined,
      primaryReferencePath: profile.primaryReferencePath || profile.referenceAudio || undefined,
      voiceProfileId: profile.voiceProfileId || profile.sourceAssetId || profile.id || undefined,
    };
    return await this.request("/api/collections/voice_profiles/records", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async updateVoiceProfile(id: string, updates: Partial<VoiceProfileRecord>): Promise<any> {
    return await this.request(`/api/collections/voice_profiles/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  }

  async deleteVoiceProfile(id: string): Promise<any> {
    return await this.request(`/api/collections/voice_profiles/records/${id}`, {
      method: "DELETE"
    });
  }

  // --- Conversations (Multi-Chat) ---
  async getConversations(projectId: string, userIdOverride?: string): Promise<ConversationRecord[]> {
    const userId = userIdOverride || this.currentUser?.id;
    if (!userId || !projectId) return [];
    try {
      const filter = encodeURIComponent(`(projectId='${projectId}' && userId='${userId}')`);
      const data = await this.request(`/api/collections/conversations/records?filter=${filter}&sort=-updated`);
      const items = data.items || [];
      return items.filter((c: any) => c.userId === userId && c.projectId === projectId);
    } catch {
      return [];
    }
  }

  async getConversationById(id: string): Promise<ConversationRecord | null> {
    try {
      return await this.request(`/api/collections/conversations/records/${id}`);
    } catch {
      return null;
    }
  }

  async createConversation(conversation: Partial<ConversationRecord>): Promise<ConversationRecord> {
    const userId = this.currentUser?.id || conversation.userId;
    return await this.request("/api/collections/conversations/records", {
      method: "POST",
      body: JSON.stringify({
        title: "New Conversation",
        archived: false,
        lastMessageAt: new Date().toISOString(),
        userId,
        ...conversation
      })
    });
  }

  async updateConversation(id: string, updates: Partial<ConversationRecord>): Promise<ConversationRecord> {
    return await this.request(`/api/collections/conversations/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  }

  async deleteConversation(id: string): Promise<any> {
    return await this.request(`/api/collections/conversations/records/${id}`, {
      method: "DELETE"
    });
  }

  // --- Generation Jobs ---
  async getGenerationJobs(projectId: string, userIdOverride?: string): Promise<GenerationJobRecord[]> {
    const userId = userIdOverride || this.currentUser?.id;
    if (!userId || !projectId) return [];
    const filter = encodeURIComponent(`(projectId='${projectId}' && userId='${userId}')`);
    const data = await this.request(`/api/collections/generation_jobs/records?filter=${filter}&sort=-created`);
    const items = data.items || [];
    return items.filter((j: any) => j.userId === userId && j.projectId === projectId);
  }

  async getGenerationJobsByConversation(conversationId: string, projectId?: string, userIdOverride?: string): Promise<GenerationJobRecord[]> {
    const userId = userIdOverride || this.currentUser?.id;
    try {
      const projFilter = projectId ? `?filter=(projectId='${projectId}')&sort=created&perPage=500` : "?sort=created&perPage=500";
      const data = await this.request(`/api/collections/generation_jobs/records${projFilter}`);
      const items: any[] = data.items || [];

      const filtered = items.filter(j => {
        if (userId && j.userId && j.userId !== userId) return false;
        if (projectId && j.projectId && j.projectId !== projectId) return false;
        if (j.conversationId === conversationId) return true;
        let styleObj: any = {};
        try {
          styleObj = typeof j.styleParams === "string" ? JSON.parse(j.styleParams) : (j.styleParams || {});
        } catch {}
        return styleObj?.conversationId === conversationId;
      });

      return filtered.map(j => {
        let styleObj: any = {};
        try {
          styleObj = typeof j.styleParams === "string" ? JSON.parse(j.styleParams) : (j.styleParams || {});
        } catch {}
        return {
          ...j,
          conversationId: j.conversationId || styleObj?.conversationId,
          expiresAt: j.expiresAt || styleObj?.expiresAt
        };
      });
    } catch (err) {
      console.warn("getGenerationJobsByConversation error:", err);
      return [];
    }
  }

  async createGenerationJob(job: Partial<GenerationJobRecord>): Promise<any> {
    let styleObj: any = {};
    if (job.styleParams) {
      try {
        styleObj = typeof job.styleParams === "string" ? JSON.parse(job.styleParams) : { ...job.styleParams };
      } catch {
        styleObj = {};
      }
    }
    if (job.conversationId && !styleObj.conversationId) {
      styleObj.conversationId = job.conversationId;
    }
    if (job.expiresAt && !styleObj.expiresAt) {
      styleObj.expiresAt = job.expiresAt;
    }
    const payload: any = {
      status: "PENDING",
      ...job,
      styleParams: JSON.stringify(styleObj)
    };
    return await this.request("/api/collections/generation_jobs/records", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async updateGenerationJob(id: string, updates: Partial<GenerationJobRecord>): Promise<any> {
    let styleObj: any = {};
    if (updates.styleParams) {
      try {
        styleObj = typeof updates.styleParams === "string" ? JSON.parse(updates.styleParams) : { ...updates.styleParams };
      } catch {
        styleObj = {};
      }
    }
    if (updates.conversationId && !styleObj.conversationId) {
      styleObj.conversationId = updates.conversationId;
    }
    if (updates.expiresAt && !styleObj.expiresAt) {
      styleObj.expiresAt = updates.expiresAt;
    }
    const payload: any = {
      ...updates
    };
    if (Object.keys(styleObj).length > 0) {
      payload.styleParams = JSON.stringify(styleObj);
    }
    return await this.request(`/api/collections/generation_jobs/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }

  async updateJob(id: string, updates: any): Promise<any> {
    return await this.updateGenerationJob(id, updates);
  }

  async getGenerationJobById(id: string): Promise<GenerationJobRecord | null> {
    try {
      return await this.request(`/api/collections/generation_jobs/records/${id}`);
    } catch {
      return null;
    }
  }

  async getGenerationJobByOutputAsset(assetNameOrPath: string): Promise<GenerationJobRecord | null> {
    try {
      const filter = encodeURIComponent(`(outputAssetId~'${assetNameOrPath}' || id='${assetNameOrPath}')`);
      const data = await this.request(`/api/collections/generation_jobs/records?filter=${filter}`);
      return (data.items && data.items.length > 0) ? data.items[0] : null;
    } catch {
      return null;
    }
  }

  // --- Benchmark Runs ---
  async getBenchmarkRuns(projectId?: string): Promise<any[]> {
    const filter = projectId ? `?filter=(projectId='${projectId}')&sort=-created` : "?sort=-created";
    const data = await this.request(`/api/collections/benchmark_runs/records${filter}`);
    return data.items || [];
  }

  async createBenchmarkRun(runData: any): Promise<any> {
    return await this.request("/api/collections/benchmark_runs/records", {
      method: "POST",
      body: JSON.stringify(runData)
    });
  }

  // --- Solarch Diagnostics & Health ---
  async getHealth(): Promise<any> {
    return await this.request("/api/health");
  }

  // --- SSE Realtime Subscription ---
  subscribeRealtime(topic: string, onMessage: (data: any) => void): () => void {
    if (typeof window === "undefined" || !window.EventSource) {
      return () => {};
    }
    const url = `${this.baseUrl}/api/realtime?topic=${encodeURIComponent(topic)}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        onMessage(payload);
      } catch (err) {}
    };
    return () => es.close();
  }
}

export const solarch = new SolarchService();
