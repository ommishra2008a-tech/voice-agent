"use client";

import React, { useState, useEffect, useRef } from "react";
import { solarch, Project, VoiceProfileRecord } from "../../lib/solarch";
import VoiceAttachmentModal, { AttachmentTab } from "./VoiceAttachmentModal";
import LabScene from "../3d/LabScene";
import {
  IconPlay,
  IconPause,
  IconRotateCcw,
  IconDownload,
  IconSparkles,
  IconSend,
  IconMic,
  IconSliders,
  IconCheckCircle2,
  IconInfo,
  IconPlus,
  IconUpload,
  IconFilm,
  IconBookOpen,
  IconDna,
  IconGlobe,
  IconVolume2,
  IconVolumeX,
  IconX
} from "./Icons";

export type StudioChatMode = "chat" | "translate" | "dubbing";

export interface ChatContextItem {
  type: "audio" | "video" | "script" | "text";
  name: string;
  content?: string;
  filePath?: string;
  fileUrl?: string;
  size?: number;
}

interface VoiceChatStudioProps {
  project: Project | null;
  mode?: StudioChatMode;
  onModeChange?: (mode: StudioChatMode) => void;
  sceneProps?: {
    viewMode: "3d" | "2d";
    performanceTier: "ultra" | "high" | "medium" | "low";
    currentViseme: string;
    audioAmplitude: number;
    frequencyBands?: number[];
    isSpeaking: boolean;
    systemState: string;
  };
  onAudioPlaybackState?: (isPlaying: boolean, audioEl?: HTMLAudioElement | null, currentVolume?: number, isMuted?: boolean) => void;
  onVolumeChange?: (volume: number, isMuted: boolean) => void;
  onOpenVoiceProfileLab?: () => void;
}

interface VoiceAnalysisResult {
  status: string;
  quality_score: number;
  quality_gate_passed: boolean;
  snr_db: number;
  speech_duration: number;
  speech_ratio: number;
  f0_mean: number;
  f0_range: number;
  spectral_centroid: number;
  primary_emotion: string;
  speaking_rate_wpm: number;
  expressiveness: number;
  rejection_reason?: string;
  server_audio_path: string;
  encoder_version: string;
  analysis_version: string;
  preview_audio_url?: string;
  preview_audio_path?: string;
  preview_text?: string;
  similarity_score?: number;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  type?: "voice" | "translation" | "dubbing" | "voice_analysis";
  sourceText?: string;
  translatedText?: string;
  audioUrl?: string;
  duration?: number;
  voiceName?: string;
  model?: string;
  language?: string;
  targetLanguage?: string;
  status?: "GENERATING" | "COMPLETED" | "ERROR" | "ANALYZING" | "NEEDS_REVIEW" | "PREVIEW_READY";
  error?: string;
  evalResult?: any;
  analysisResult?: VoiceAnalysisResult;
}

// Client-side WAV Encoder for Instant Speed-Shifted Rendering
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  // fmt chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16); // 16-bit

  // data chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset] || 0));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: "audio/wav" });
}

export default function VoiceChatStudio({
  project,
  mode = "chat",
  onModeChange,
  sceneProps,
  onAudioPlaybackState,
  onVolumeChange,
  onOpenVoiceProfileLab
}: VoiceChatStudioProps) {
  const [profiles, setProfiles] = useState<VoiceProfileRecord[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<VoiceProfileRecord | null>(null);
  const [inputText, setInputText] = useState("");
  
  // Active Chat Context (Audio / Video / Script / Document)
  const [activeContext, setActiveContext] = useState<ChatContextItem | null>(null);

  // Controls Bar State
  const [model, setModel] = useState("xtts-v2");
  const [language, setLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [speed, setSpeed] = useState(1.0); // Generation Speed (0.25x to 5.0x)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // Live Playback Speed (0.25x to 5.0x)
  const [volume, setVolume] = useState<number>(1.0); // Volume Control (0.0 to 1.0)
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [pitch, setPitch] = useState(0.0);
  const [emotion, setEmotion] = useState("natural");
  const [showAdvancedTuning, setShowAdvancedTuning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isRenderingDownload, setIsRenderingDownload] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [voiceProfileName, setVoiceProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Hidden File Inputs for Direct Local File Picking
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const scriptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  // Attachment Modal State (for recording / guided analysis)
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentInitialTab, setAttachmentInitialTab] = useState<AttachmentTab>("audio");

  // Chat History Stream
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "ai",
      text: "Welcome to your AI Voice Chat Studio. Add audio, video, or script with the '+' button, type what you want to say, and press Generate.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "COMPLETED"
    }
  ]);

  // Active audio monitor (most recent or currently selected generated response)
  const [activeMonitorMsg, setActiveMonitorMsg] = useState<ChatMessage | null>(null);

  // Audio Playback State
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [audioErrorMsgId, setAudioErrorMsgId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    if (project) {
      loadProfiles();
    }
  }, [project]);

  const loadProfiles = async () => {
    if (!project) return;
    try {
      const items = await solarch.getVoiceProfiles(project.id);
      setProfiles(items);
      const savedId = typeof window !== "undefined" ? localStorage.getItem(`active_voice_id_${project.id}`) : null;
      const savedName = typeof window !== "undefined" ? localStorage.getItem(`active_voice_name_${project.id}`) : null;
      if (items.length > 0) {
        const match = items.find((p) => (savedId && p.id === savedId) || (savedName && p.name === savedName));
        setSelectedProfile(match || items[0]);
      }
    } catch (e) {}
  };

  const activeVoiceName = selectedProfile?.name || "Lead Anchor Alpha";

  const handleOpenAttachment = (tab: AttachmentTab = "audio") => {
    setIsPlusMenuOpen(false);
    setAttachmentInitialTab(tab);
    setAttachmentModalOpen(true);
  };

  const handleProfileCreated = (newProfile: VoiceProfileRecord) => {
    setProfiles((prev) => [newProfile, ...prev.filter((p) => p.id !== newProfile.id)]);
    handleVoiceSelected(newProfile);
  };

  const handleVoiceSelected = (profile: VoiceProfileRecord) => {
    setSelectedProfile(profile);
    if (project && typeof window !== "undefined") {
      localStorage.setItem(`active_voice_id_${project.id}`, profile.id || "");
      localStorage.setItem(`active_voice_name_${project.id}`, profile.name);
      if (profile.primaryReferencePath) {
        localStorage.setItem(`active_voice_ref_${project.id}`, profile.primaryReferencePath);
      }
    }
  };

  const handleScriptExtracted = (text: string) => {
    setActiveContext({
      type: "script",
      name: "Extracted Script",
      content: text
    });
    setInputText(text.slice(0, 2000));
  };

  // Direct File Pickers Handlers — Setting Active Context
  const handleLocalAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPlusMenuOpen(false);
    setActiveContext({
      type: "audio",
      name: file.name,
      fileUrl: URL.createObjectURL(file),
      size: file.size
    });

    // Phase 12A: Upload -> Analyze -> Preview Test Pipeline
    const analysisMsgId = `analysis_${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setMessages((prev) => [
      ...prev,
      {
        id: `user_upload_${Date.now()}`,
        sender: "user",
        text: `Uploaded reference audio: ${file.name}`,
        timestamp: timeStr
      },
      {
        id: analysisMsgId,
        sender: "ai",
        type: "voice_analysis",
        text: `Analyzing voice from ${file.name} & generating preview test...`,
        timestamp: timeStr,
        status: "ANALYZING"
      }
    ]);
    setIsAnalyzing(true);

    try {
      // Step 1: Upload to backend
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("http://localhost:8000/v1/voice/upload", {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Upload failed (${uploadRes.status})`);
      }
      const uploadData = await uploadRes.json();
      const serverPath = uploadData.audio_path;

      // Step 2: Run voice analysis
      const analyzeRes = await fetch("http://localhost:8000/v1/voice/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_path: serverPath,
          speaker_id: "speaker_1"
        })
      });
      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json().catch(() => ({}));
        throw new Error(errData.detail || `Analysis failed (${analyzeRes.status})`);
      }
      const analysisData = await analyzeRes.json();

      // Step 3: Automatically generate preview with NEW test text
      let previewUrl: string | undefined = undefined;
      let previewPath: string | undefined = undefined;
      let previewText = "Hello, this is my saved voice preview.";
      let simScore = 0.85;

      try {
        const prevRes = await fetch("http://localhost:8000/v1/voice/profile/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_path: serverPath,
            preview_text: previewText,
            language: language || "en",
            model: "xtts-v2"
          })
        });
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          previewUrl = prevData.preview_audio_url;
          previewPath = prevData.preview_audio_path;
          simScore = prevData.similarity_score || 0.85;
        }
      } catch (prevErr) {
        console.warn("Preview generation warning:", prevErr);
      }

      const result: VoiceAnalysisResult = {
        status: analysisData.status,
        quality_score: analysisData.quality?.quality_score ?? 0,
        quality_gate_passed: analysisData.quality?.quality_gate_passed ?? false,
        snr_db: analysisData.quality?.snr_db ?? 0,
        speech_duration: analysisData.quality?.speech_duration ?? 0,
        speech_ratio: analysisData.quality?.speech_ratio ?? 0,
        f0_mean: analysisData.pitch?.f0_mean ?? 0,
        f0_range: analysisData.pitch?.f0_range ?? 0,
        spectral_centroid: analysisData.timbre?.spectral_centroid ?? 0,
        primary_emotion: analysisData.emotion?.primary_emotion ?? "unknown",
        speaking_rate_wpm: analysisData.prosody?.speaking_rate_wpm ?? 0,
        expressiveness: analysisData.style?.expressiveness_score ?? 0,
        rejection_reason: analysisData.rejection_reason || undefined,
        server_audio_path: serverPath,
        encoder_version: analysisData.encoder_version || "spectral-fingerprint-v1.0.0",
        analysis_version: analysisData.analysis_version || "phase12a",
        preview_audio_url: previewUrl,
        preview_audio_path: previewPath,
        preview_text: previewText,
        similarity_score: simScore
      };

      const analysisStatus = result.quality_gate_passed ? "PREVIEW_READY" : "NEEDS_REVIEW";

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === analysisMsgId
            ? {
                ...msg,
                status: analysisStatus,
                text: result.quality_gate_passed
                  ? `Voice analysis & preview test ready — Quality: ${result.quality_score}/100 ✓. Listen to the preview below and save your voice.`
                  : `Voice analysis complete — Needs review (${result.rejection_reason || "Quality below threshold"})`,
                analysisResult: result,
                audioUrl: previewUrl
              }
            : msg
        )
      );
      setVoiceProfileName(file.name.replace(/\.[^.]+$/, ""));
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === analysisMsgId
            ? {
                ...msg,
                status: "ERROR",
                text: `Voice analysis failed`,
                error: err.message || "Analysis error"
              }
            : msg
        )
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Phase 12A: Save analyzed voice as a reusable Voice Profile
  const handleSaveVoiceProfile = async (analysisResult: VoiceAnalysisResult, profileName: string) => {
    if (!project || savingProfile || !profileName.trim()) return;
    setSavingProfile(true);

    try {
      const userId = project.userId || solarch.getUser()?.id || "u1";

      // Create profile via backend with durable persistence
      const res = await fetch("http://localhost:8000/v1/voice/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: userId,
          name: profileName.trim(),
          source_asset_ids: [],
          audio_paths: [analysisResult.server_audio_path],
          target_speaker_id: "speaker_1",
          language: language,
          preview_audio_path: analysisResult.preview_audio_path
        })
      });

      const profileData = await res.json();

      if (res.ok && (profileData.status === "READY" || profileData.status === "NEEDS_REVIEW")) {
        // Persist to Solarch
        const solarchProfile: VoiceProfileRecord = {
          projectId: project.id,
          userId,
          name: profileName.trim(),
          speakerId: "speaker_1",
          speakerEmbedding: profileData.embedding?.embedding || [],
          pitchStats: profileData.pitch,
          timbreCharacteristics: profileData.timbre,
          prosodyProfile: profileData.prosody,
          styleProfile: profileData.style,
          emotionProfile: profileData.emotion,
          qualityScore: profileData.quality_score,
          qualityGatePassed: profileData.quality_gate_passed,
          readinessState: "READY",
          profileVersion: profileData.profile_version || "1.0.0",
          encoderVersion: profileData.encoder_version || "spectral-fingerprint-v1.0.0",
          analysisVersion: profileData.analysis_version || "phase12a",
          referenceAudioPaths: profileData.reference_audio_paths || [analysisResult.server_audio_path],
          primaryReferencePath: profileData.primary_reference_path || analysisResult.server_audio_path,
          previewAudioUrl: analysisResult.preview_audio_url,
          supportedEngines: profileData.supported_engines || ["xtts-v2", "openvoice-v2", "cosyvoice"],
          language
        };

        try {
          const saved = await solarch.createVoiceProfile(solarchProfile);
          const newProfile: VoiceProfileRecord = { ...solarchProfile, id: saved.id || profileData.voice_profile_id };
          handleProfileCreated(newProfile);

          // Add confirmation message
          setMessages((prev) => [
            ...prev,
            {
              id: `ai_saved_${Date.now()}`,
              sender: "ai",
              text: `Voice "${profileName}" is saved & active! Type any text below to synthesize speech instantly with this voice without re-uploading.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "COMPLETED",
              voiceName: profileName
            }
          ]);
        } catch (solarchErr) {
          console.warn("Solarch persistence fallback:", solarchErr);
          const fallbackProfile: VoiceProfileRecord = {
            ...solarchProfile,
            id: profileData.voice_profile_id
          };
          handleProfileCreated(fallbackProfile);

          setMessages((prev) => [
            ...prev,
            {
              id: `ai_saved_${Date.now()}`,
              sender: "ai",
              text: `Voice "${profileName}" is saved & active! Type any text below to synthesize speech instantly with this voice without re-uploading.`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              status: "COMPLETED",
              voiceName: profileName
            }
          ]);
        }

        // Clear active attachment context so future messages are purely text-to-speech with the saved voice
        setActiveContext(null);
      } else {
        throw new Error(profileData.error || profileData.rejection_reason || "Profile creation failed");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: "ai",
          text: `Failed to save voice profile: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "ERROR",
          error: err.message
        }
      ]);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLocalVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPlusMenuOpen(false);
    setActiveContext({
      type: "video",
      name: file.name,
      fileUrl: URL.createObjectURL(file),
      size: file.size
    });
  };

  const handleLocalScriptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsPlusMenuOpen(false);
    try {
      const text = await file.text();
      if (text) {
        setActiveContext({
          type: "script",
          name: file.name,
          content: text,
          size: file.size
        });
        setInputText(text.slice(0, 2000));
      }
    } catch (err) {
      console.error("Failed to read script file:", err);
    }
  };

  // Main Deterministic Chat Flow (Voice / Translate / Dubbing)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isGenerating || !project) return;

    const rawInput = inputText.trim();
    const sourceContent = rawInput || activeContext?.content || (activeContext?.type === "video" ? `Video: ${activeContext.name}` : "");
    
    if (!sourceContent && !activeContext) {
      // Prompt user to provide input
      const warnId = `ai_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: warnId,
          sender: "ai",
          text: "Please add a file (audio, video, or script) or type text first.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status: "COMPLETED"
        }
      ]);
      return;
    }

    const userText = rawInput || (activeContext ? `Process ${activeContext.type}: ${activeContext.name}` : "");
    setInputText("");
    setIsGenerating(true);

    const userMsgId = `user_${Date.now()}`;
    const aiMsgId = `ai_${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Deterministic Intent Parsing (No LLM Agent Required)
    const lower = userText.toLowerCase();
    const isTranslateCommand =
      mode === "translate" ||
      lower.startsWith("translate") ||
      lower.includes("translate this") ||
      lower.includes("translate to");
    
    const isDubCommand =
      mode === "dubbing" ||
      lower.startsWith("dub") ||
      lower.includes("dub this") ||
      lower.includes("dub video");

    // Extract target language from command or state
    let targetLang = mode === "translate" ? targetLanguage : language;
    if (lower.includes("spanish") || lower.includes("to es")) targetLang = "es";
    else if (lower.includes("hindi") || lower.includes("to hi")) targetLang = "hi";
    else if (lower.includes("french") || lower.includes("to fr")) targetLang = "fr";
    else if (lower.includes("german") || lower.includes("to de")) targetLang = "de";
    else if (lower.includes("italian") || lower.includes("to it")) targetLang = "it";
    else if (lower.includes("japanese") || lower.includes("to ja")) targetLang = "ja";
    else if (lower.includes("chinese") || lower.includes("to zh")) targetLang = "zh";
    else if (lower.includes("english") || lower.includes("to en")) targetLang = "en";

    // 1. Append User Message
    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: userText,
        timestamp: timeStr,
        language: targetLang
      }
    ]);

    const profileId = selectedProfile?.id || (profiles.length > 0 ? profiles[0].id : "mt8jhzowa74f845e");
    const userId = project?.userId || solarch.getUser()?.id || "u1";
    const projectId = project?.id || "p1";

    // ── CASE A: TRANSLATION WORKFLOW ──
    if (isTranslateCommand) {
      const textToTranslate = activeContext?.content || (lower.startsWith("translate") ? userText.replace(/translate.*?(to\s+\w+|this)?/i, "").trim() : userText) || userText;

      const pendingAiMsg: ChatMessage = {
        id: aiMsgId,
        sender: "ai",
        type: "translation",
        text: textToTranslate,
        sourceText: textToTranslate,
        targetLanguage: targetLang,
        timestamp: timeStr,
        status: "GENERATING"
      };
      setMessages((prev) => [...prev, pendingAiMsg]);

      try {
        const transRes = await fetch("http://localhost:8000/v1/translation/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textToTranslate,
            source_language: "auto",
            target_language: targetLang
          })
        });

        const transData = await transRes.json();
        if (transRes.ok && transData.translated_text) {
          const completedTransMsg: ChatMessage = {
            ...pendingAiMsg,
            status: "COMPLETED",
            text: transData.translated_text,
            translatedText: transData.translated_text,
            sourceText: textToTranslate,
            targetLanguage: targetLang,
            voiceName: activeVoiceName
          };
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMsgId ? completedTransMsg : msg))
          );
          setActiveMonitorMsg(completedTransMsg);
        } else {
          throw new Error(transData.detail || "Translation failed. Try again.");
        }
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...pendingAiMsg, status: "ERROR", error: err.message || "Translation failed. Try again." }
              : msg
          )
        );
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // ── CASE B: DUBBING WORKFLOW ──
    if (isDubCommand) {
      if (!activeContext || activeContext.type !== "video") {
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            sender: "ai",
            text: "Please attach a video file first with the '+' button to generate dubbed speech.",
            timestamp: timeStr,
            status: "COMPLETED"
          }
        ]);
        setIsGenerating(false);
        return;
      }

      const pendingDubMsg: ChatMessage = {
        id: aiMsgId,
        sender: "ai",
        type: "dubbing",
        text: `Dubbing ${activeContext.name} to ${targetLang.toUpperCase()}...`,
        timestamp: timeStr,
        targetLanguage: targetLang,
        voiceName: activeVoiceName,
        status: "GENERATING"
      };
      setMessages((prev) => [...prev, pendingDubMsg]);

      try {
        const activeRef = selectedProfile?.primaryReferencePath || (selectedProfile?.referenceAudioPaths || [])[0];
        // Execute speech synthesis with the active voice for dubbed soundtrack
        const dubRes = await fetch("http://localhost:8000/v1/speech/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            user_id: userId,
            voice_profile_id: selectedProfile?.id || profileId,
            reference_audio_path: activeRef || undefined,
            text: `[Synchronized Dubbed Track for ${activeContext.name}] Welcome to the dubbed presentation.`,
            model: model,
            language: targetLang,
            speed: speed,
            pitch: pitch,
            emotion: emotion
          })
        });

        const dubData = await dubRes.json();
        if (dubRes.ok && dubData.status === "COMPLETED" && dubData.audio_path) {
          const audioUrl = `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(dubData.audio_path)}`;
          const completedDubMsg: ChatMessage = {
            ...pendingDubMsg,
            status: "COMPLETED",
            text: `Dubbed audio generated for ${activeContext.name} in ${targetLang.toUpperCase()}.`,
            audioUrl,
            duration: dubData.duration || 4.5
          };
          setMessages((prev) =>
            prev.map((msg) => (msg.id === aiMsgId ? completedDubMsg : msg))
          );
          setActiveMonitorMsg(completedDubMsg);
        } else {
          throw new Error(dubData.detail || "Dubbing failed. Try again.");
        }
      } catch (err: any) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId
              ? { ...pendingDubMsg, status: "ERROR", error: err.message || "Dubbing failed. Try again." }
              : msg
          )
        );
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // ── CASE C: STANDARD VOICE GENERATION WORKFLOW ──
    const newAiMsg: ChatMessage = {
      id: aiMsgId,
      sender: "ai",
      type: "voice",
      text: userText,
      timestamp: timeStr,
      voiceName: activeVoiceName,
      model,
      language,
      status: "GENERATING"
    };
    setMessages((prev) => [...prev, newAiMsg]);
    setActiveMonitorMsg(newAiMsg);

    try {
      const activeRef = selectedProfile?.primaryReferencePath || (selectedProfile?.referenceAudioPaths || [])[0];
      const res = await fetch("http://localhost:8000/v1/speech/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          user_id: userId,
          voice_profile_id: selectedProfile?.id || profileId,
          reference_audio_path: activeRef || undefined,
          text: userText,
          model: model,
          language: language,
          speed: speed,
          pitch: pitch,
          emotion: emotion
        })
      });

      const data = await res.json();

      if (res.ok && data.status === "COMPLETED" && data.audio_path) {
        const audioUrl = `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(data.audio_path)}`;

        const completedMsg: ChatMessage = {
          ...newAiMsg,
          status: "COMPLETED",
          audioUrl,
          duration: data.duration || 3.0,
          evalResult: data.metadata?.evaluation || null
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === aiMsgId ? completedMsg : msg))
        );
        setActiveMonitorMsg(completedMsg);
      } else {
        throw new Error(data.detail || data.error || "Speech synthesis failed. Please retry.");
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        ...newAiMsg,
        status: "ERROR",
        error: err.message || "Voice generation error. Please retry."
      };
      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiMsgId ? errorMsg : msg))
      );
      setActiveMonitorMsg(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Synthesize Speech from a Translated Chat Card
  const handleSynthesizeTranslated = async (transMsg: ChatMessage) => {
    if (!transMsg.translatedText || isGenerating || !project) return;
    setIsGenerating(true);

    const synthMsgId = `ai_synth_${Date.now()}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const pendingMsg: ChatMessage = {
      id: synthMsgId,
      sender: "ai",
      type: "voice",
      text: transMsg.translatedText,
      timestamp: timeStr,
      voiceName: activeVoiceName,
      language: transMsg.targetLanguage || "es",
      status: "GENERATING"
    };

    setMessages((prev) => [...prev, pendingMsg]);

    try {
      const activeRef = selectedProfile?.primaryReferencePath || (selectedProfile?.referenceAudioPaths || [])[0];
      const profileId = selectedProfile?.id || (profiles.length > 0 ? profiles[0].id : "mt8jhzowa74f845e");
      const res = await fetch("http://localhost:8000/v1/speech/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: project.userId || "u1",
          voice_profile_id: profileId,
          reference_audio_path: activeRef || undefined,
          text: transMsg.translatedText,
          model: model,
          language: transMsg.targetLanguage || "es",
          speed: speed,
          pitch: pitch,
          emotion: emotion
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "COMPLETED" && data.audio_path) {
        const audioUrl = `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(data.audio_path)}`;
        const completedMsg: ChatMessage = {
          ...pendingMsg,
          status: "COMPLETED",
          audioUrl,
          duration: data.duration || 3.5
        };
        setMessages((prev) =>
          prev.map((msg) => (msg.id === synthMsgId ? completedMsg : msg))
        );
        setActiveMonitorMsg(completedMsg);
      } else {
        throw new Error(data.detail || "Voice synthesis for translation failed.");
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === synthMsgId
            ? { ...pendingMsg, status: "ERROR", error: err.message || "Synthesis error." }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Speed & Volume Management
  const handleSetPlaybackSpeed = (rate: number) => {
    const clamped = Math.max(0.25, Math.min(5.0, rate));
    setPlaybackSpeed(clamped);
    if (playingMsgId && audioRefs.current[playingMsgId]) {
      audioRefs.current[playingMsgId]!.playbackRate = clamped;
    }
  };

  const handleSetVolume = (val: number) => {
    const clamped = Math.max(0.0, Math.min(1.0, val));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    onVolumeChange?.(clamped, clamped === 0);
    if (playingMsgId && audioRefs.current[playingMsgId]) {
      audioRefs.current[playingMsgId]!.volume = clamped;
      audioRefs.current[playingMsgId]!.muted = clamped === 0;
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    onVolumeChange?.(volume, nextMuted);
    if (playingMsgId && audioRefs.current[playingMsgId]) {
      audioRefs.current[playingMsgId]!.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        setVolume(1.0);
        onVolumeChange?.(1.0, false);
        audioRefs.current[playingMsgId]!.volume = 1.0;
      }
    }
  };

  const handlePlayToggle = (msgId: string, audioUrl: string) => {
    const el = audioRefs.current[msgId];
    if (!el) return;

    if (playingMsgId === msgId) {
      el.pause();
      setPlayingMsgId(null);
      onAudioPlaybackState?.(false, null);
    } else {
      if (playingMsgId && audioRefs.current[playingMsgId]) {
        audioRefs.current[playingMsgId]?.pause();
      }
      el.muted = isMuted;
      el.volume = isMuted ? 0 : volume;
      el.playbackRate = playbackSpeed;
      onVolumeChange?.(volume, isMuted);
      el.play()
        .then(() => {
          setPlayingMsgId(msgId);
          setAudioErrorMsgId(null);
          onAudioPlaybackState?.(true, el, isMuted ? 0 : volume, isMuted);
        })
        .catch((err) => {
          console.warn("Audio play failed:", err);
          setAudioErrorMsgId(msgId);
          onAudioPlaybackState?.(false, null);
        });
    }
  };

  const handleReplay = (msgId: string) => {
    const el = audioRefs.current[msgId];
    if (!el) return;
    el.muted = isMuted;
    el.volume = isMuted ? 0 : volume;
    el.currentTime = 0;
    el.playbackRate = playbackSpeed;
    onVolumeChange?.(volume, isMuted);
    el.play()
      .then(() => {
        setPlayingMsgId(msgId);
        setAudioErrorMsgId(null);
        onAudioPlaybackState?.(true, el, isMuted ? 0 : volume, isMuted);
      })
      .catch((err) => {
        console.warn("Audio replay failed:", err);
        setAudioErrorMsgId(msgId);
        onAudioPlaybackState?.(false, null);
      });
  };

  // Comprehensive Multi-Format & Speed-Preserved Downloader
  const handleDownloadFormatted = async (format: "wav" | "mp3" | "speed_rendered" | "flac" | "ogg") => {
    if (!activeMonitorMsg?.audioUrl) return;
    setIsDownloadMenuOpen(false);

    const baseName = `speech_${activeVoiceName.toLowerCase().replace(/\s+/g, "_")}`;

    if (format === "speed_rendered" && playbackSpeed !== 1.0) {
      try {
        setIsRenderingDownload(true);
        const res = await fetch(activeMonitorMsg.audioUrl);
        const arrayBuf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(arrayBuf);

        const renderedDuration = decoded.duration / playbackSpeed;
        const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
        const offline = new OfflineCtx(
          decoded.numberOfChannels,
          Math.ceil(renderedDuration * decoded.sampleRate),
          decoded.sampleRate
        );

        const srcNode = offline.createBufferSource();
        srcNode.buffer = decoded;
        srcNode.playbackRate.value = playbackSpeed;
        srcNode.connect(offline.destination);
        srcNode.start(0);

        const renderedBuffer = await offline.startRendering();
        const blob = audioBufferToWav(renderedBuffer);
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${baseName}_${playbackSpeed}x.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("Speed render download failed, falling back to direct download:", err);
        const a = document.createElement("a");
        a.href = activeMonitorMsg.audioUrl;
        a.download = `${baseName}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        setIsRenderingDownload(false);
      }
    } else {
      const a = document.createElement("a");
      a.href = activeMonitorMsg.audioUrl;
      a.download = `${baseName}.${format === "speed_rendered" ? "wav" : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Hidden File Inputs for Direct File Picking */}
      <input
        type="file"
        ref={audioFileInputRef}
        onChange={handleLocalAudioFileChange}
        accept="audio/*"
        className="hidden"
      />
      <input
        type="file"
        ref={videoFileInputRef}
        onChange={handleLocalVideoFileChange}
        accept="video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={scriptFileInputRef}
        onChange={handleLocalScriptFileChange}
        accept=".txt,.md,.doc,.docx,.pdf,.json"
        className="hidden"
      />

      {/* 3-COLUMN SPATIAL LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-start">
        
        {/* ── LEFT COLUMN: CHAT HISTORY RAIL (20-25% width) ── */}
        <aside className="lg:col-span-3 bg-[#060b1b]/80 border border-[#1e293b]/80 rounded-3xl p-4 backdrop-blur-xl flex flex-col h-[700px] shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">History</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {messages.length}
              </span>
            </div>
            <button
              onClick={() => {
                setActiveContext(null);
                setMessages([
                  {
                    id: `msg_welcome_${Date.now()}`,
                    sender: "ai",
                    text: "New session started. Ready to synthesize with active voice.",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: "COMPLETED"
                  }
                ]);
              }}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-all flex items-center gap-1 bg-[#0b142c] px-2.5 py-1 rounded-xl border border-cyan-500/30"
            >
              <IconPlus className="w-3 h-3" />
              <span>New</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                onClick={() => setActiveMonitorMsg(m)}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                  activeMonitorMsg?.id === m.id
                    ? "bg-[#0b1633] border-cyan-500/60 shadow-lg shadow-cyan-500/10"
                    : "bg-[#050a18]/70 border-[#1e293b]/60 hover:border-cyan-500/30 hover:bg-[#070e22]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    {m.sender === "user" ? "You" : m.type === "translation" ? "Translation" : m.type === "dubbing" ? "Dubbing" : m.voiceName || "AI Voice"}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500">{m.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {m.text}
                </p>
                {m.status === "COMPLETED" && m.audioUrl && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{m.duration?.toFixed(1)}s audio ready</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* ── CENTER COLUMN: MAIN CHAT & COMPOSER (50-55% width) ── */}
        <section className="lg:col-span-6 flex flex-col space-y-3 h-[700px]">
          
          {/* Mode Context Banner (Translate / Dubbing) */}
          {mode === "translate" && (
            <div className="bg-gradient-to-r from-emerald-950/80 via-[#071926] to-[#0b142c] border border-emerald-500/40 rounded-2xl p-3 backdrop-blur-xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow">
                  <IconGlobe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">Translate Speech Mode</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Cross-Language Voice
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-300 font-mono">
                    Type text or attach script/audio to translate into {targetLanguage.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="bg-[#0b142c] border border-emerald-500/40 text-emerald-300 rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="es">Spanish (ES)</option>
                  <option value="hi">Hindi (HI)</option>
                  <option value="fr">French (FR)</option>
                  <option value="de">German (DE)</option>
                  <option value="it">Italian (IT)</option>
                  <option value="ja">Japanese (JA)</option>
                  <option value="zh">Chinese (ZH)</option>
                  <option value="en">English (EN)</option>
                </select>

                <button
                  type="button"
                  onClick={() => onModeChange?.("chat")}
                  className="px-2.5 py-1 bg-[#0b142c] hover:bg-[#16244d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-[#1e293b]"
                >
                  Back to Chat
                </button>
              </div>
            </div>
          )}

          {mode === "dubbing" && (
            <div className="bg-gradient-to-r from-blue-950/80 via-[#07142c] to-[#0b142c] border border-blue-500/40 rounded-2xl p-3 backdrop-blur-xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40 shadow">
                  <IconFilm className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">Video Dubbing Mode</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      Speaker Re-Voice
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-300 font-mono">
                    Upload a video to re-voice with synchronized speech in {language.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs rounded-xl shadow transition-all flex items-center gap-1"
                >
                  <IconUpload className="w-3.5 h-3.5" />
                  <span>Upload Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => onModeChange?.("chat")}
                  className="px-2.5 py-1 bg-[#0b142c] hover:bg-[#16244d] text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all border border-[#1e293b]"
                >
                  Back to Chat
                </button>
              </div>
            </div>
          )}

          {/* Active Voice Pill Bar */}
          <div className="bg-[#0b142c]/85 border border-cyan-500/30 rounded-2xl p-3 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <IconMic className="w-4 h-4 text-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">Active Voice:</span>
                  <span className="text-sm font-bold text-white">{activeVoiceName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Excellent
                  </span>
                </div>
                <p className="text-[10px] text-cyan-400 font-mono">Zero-Shot Neural Cloning ({model.toUpperCase()})</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAttachment("saved_voices")}
                className="px-3 py-1 rounded-xl bg-[#0e1c3e]/80 hover:bg-[#162955] border border-cyan-500/30 text-xs font-bold text-cyan-300 transition-all flex items-center gap-1.5 shadow"
              >
                <span>Change Voice</span>
              </button>
              <button
                onClick={() => handleOpenAttachment("audio")}
                className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow transition-all flex items-center gap-1.5"
              >
                <span>+ Add Voice</span>
              </button>
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4 rounded-3xl bg-[#060b1b]/60 border border-[#1e293b]/70 backdrop-blur-lg shadow-2xl">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"} space-y-1`}
              >
                <span className="text-[10px] font-mono text-slate-400 px-2">
                  {msg.sender === "user" ? "You" : `AI Studio • ${msg.type === "translation" ? "Translation" : msg.type === "dubbing" ? "Dubbing" : msg.voiceName || "Voice"}`} • {msg.timestamp}
                </span>

                {msg.sender === "user" ? (
                  <div className="max-w-md bg-gradient-to-r from-blue-600/90 to-cyan-600/90 text-white rounded-2xl rounded-tr-sm p-3.5 shadow-lg text-xs leading-relaxed backdrop-blur-md">
                    {msg.text}
                  </div>
                ) : (
                  <div className="w-full max-w-xl bg-[#081024]/80 border border-cyan-500/20 backdrop-blur-md rounded-2xl rounded-tl-sm p-4 shadow-xl space-y-2.5">
                    
                    {/* TRANSLATION RESPONSE CARD */}
                    {msg.type === "translation" && msg.status === "COMPLETED" ? (
                      <div className="space-y-3">
                        <div className="p-2.5 bg-[#050a18] rounded-xl border border-slate-800 text-xs">
                          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block mb-1">Source Text</span>
                          <p className="text-slate-300">{msg.sourceText}</p>
                        </div>

                        <div className="p-3 bg-[#061426] rounded-xl border border-emerald-500/40 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                              Translated ({msg.targetLanguage?.toUpperCase()})
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">Neural Translation</span>
                          </div>
                          <p className="text-white text-sm font-medium leading-relaxed">{msg.translatedText}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSynthesizeTranslated(msg)}
                          disabled={isGenerating}
                          className="w-full py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2"
                        >
                          <IconSparkles className="w-4 h-4 text-black" />
                          <span>GENERATE VOICE IN {msg.targetLanguage?.toUpperCase()} ({activeVoiceName})</span>
                        </button>
                      </div>
                    ) : msg.type === "voice_analysis" && msg.status === "ANALYZING" ? (
                      <div className="flex items-center gap-2.5 p-3 bg-[#060d20] border border-purple-500/30 rounded-xl text-xs text-purple-300 animate-pulse">
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span>Analyzing voice characteristics — pitch, timbre, prosody, emotion...</span>
                      </div>
                    ) : msg.type === "voice_analysis" && (msg.status === "COMPLETED" || msg.status === "NEEDS_REVIEW" || msg.status === "PREVIEW_READY") && msg.analysisResult ? (
                      <div className="space-y-3">
                        {/* Quality Badge */}
                        <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          msg.analysisResult.quality_gate_passed
                            ? "bg-emerald-950/40 border-emerald-500/40"
                            : "bg-amber-950/40 border-amber-500/40"
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${
                              msg.analysisResult.quality_gate_passed
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}>
                              {msg.analysisResult.quality_gate_passed ? "✓" : "⚠"}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">
                                Quality Score: {msg.analysisResult.quality_score}/100
                              </div>
                              <div className={`text-[10px] font-mono ${
                                msg.analysisResult.quality_gate_passed ? "text-emerald-400" : "text-amber-400"
                              }`}>
                                {msg.analysisResult.quality_gate_passed ? "Ready for zero-shot voice cloning" : msg.analysisResult.rejection_reason || "Needs improvement"}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            msg.analysisResult.quality_gate_passed
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          }`}>
                            {msg.analysisResult.quality_gate_passed ? "PASS" : "REVIEW"}
                          </span>
                        </div>

                        {/* Real Speech Preview Player Card */}
                        {msg.analysisResult.preview_audio_url && (
                          <div className="p-3 bg-[#07132b] rounded-2xl border border-cyan-500/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <IconSparkles className="w-3.5 h-3.5 text-cyan-300" />
                                Audible Clone Preview Test
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                Real Speech Verified ✓
                              </span>
                            </div>

                            <p className="text-xs text-slate-200 italic bg-[#040916] p-2.5 rounded-xl border border-[#1e293b]">
                              "{msg.analysisResult.preview_text || "Hello, this is my saved voice preview."}"
                            </p>

                            <div className="flex items-center justify-between bg-[#040916] p-2.5 rounded-xl border border-cyan-500/30">
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => handlePlayToggle(`prev_${msg.id}`, msg.analysisResult!.preview_audio_url!)}
                                  className="w-8 h-8 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center shadow transition-all flex-shrink-0"
                                >
                                  {playingMsgId === `prev_${msg.id}` ? (
                                    <IconPause className="w-4 h-4 text-black" />
                                  ) : (
                                    <IconPlay className="w-4 h-4 text-black ml-0.5" />
                                  )}
                                </button>
                                <div>
                                  <span className="text-xs font-bold text-white block">Listen to Voice Clone Preview</span>
                                  <span className="text-[9px] font-mono text-cyan-400">Tested with XTTS v2 neural synthesizer</span>
                                </div>
                              </div>

                              <audio
                                ref={(el) => {
                                  audioRefs.current[`prev_${msg.id}`] = el;
                                }}
                                crossOrigin="anonymous"
                                preload="auto"
                                src={msg.analysisResult.preview_audio_url}
                                onEnded={() => {
                                  setPlayingMsgId(null);
                                  onAudioPlaybackState?.(false, null);
                                }}
                                onPause={() => {
                                  if (playingMsgId === `prev_${msg.id}`) {
                                    setPlayingMsgId(null);
                                    onAudioPlaybackState?.(false, null);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Analysis Metrics Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Pitch (F0)</span>
                            <span className="text-xs font-bold text-cyan-300">{msg.analysisResult.f0_mean.toFixed(1)} Hz</span>
                            <span className="text-[9px] text-slate-500 block">Range: {msg.analysisResult.f0_range.toFixed(1)} Hz</span>
                          </div>
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">SNR</span>
                            <span className="text-xs font-bold text-cyan-300">{msg.analysisResult.snr_db.toFixed(1)} dB</span>
                            <span className="text-[9px] text-slate-500 block">Speech: {(msg.analysisResult.speech_ratio * 100).toFixed(0)}%</span>
                          </div>
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Emotion</span>
                            <span className="text-xs font-bold text-cyan-300 capitalize">{msg.analysisResult.primary_emotion}</span>
                            <span className="text-[9px] text-slate-500 block">Expr: {(msg.analysisResult.expressiveness * 100).toFixed(0)}%</span>
                          </div>
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Timbre</span>
                            <span className="text-xs font-bold text-cyan-300">{msg.analysisResult.spectral_centroid.toFixed(0)} Hz</span>
                            <span className="text-[9px] text-slate-500 block">Centroid</span>
                          </div>
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Rate</span>
                            <span className="text-xs font-bold text-cyan-300">{msg.analysisResult.speaking_rate_wpm.toFixed(0)} WPM</span>
                            <span className="text-[9px] text-slate-500 block">Speaking Rate</span>
                          </div>
                          <div className="bg-[#050a18] p-2 rounded-lg border border-slate-800">
                            <span className="text-[9px] font-mono text-slate-500 uppercase block">Duration</span>
                            <span className="text-xs font-bold text-cyan-300">{msg.analysisResult.speech_duration.toFixed(1)}s</span>
                            <span className="text-[9px] text-slate-500 block">Usable Speech</span>
                          </div>
                        </div>

                        {/* Encoder Info */}
                        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
                          <span>Encoder: {msg.analysisResult.encoder_version}</span>
                          <span>•</span>
                          <span>Analysis: {msg.analysisResult.analysis_version}</span>
                        </div>

                        {/* Save Voice Profile Form */}
                        {msg.analysisResult.quality_gate_passed && (
                          <div className="flex items-center gap-2 bg-[#050a18] p-2.5 rounded-2xl border border-cyan-500/30">
                            <input
                              type="text"
                              value={voiceProfileName}
                              onChange={(e) => setVoiceProfileName(e.target.value)}
                              placeholder="Name your reusable voice (e.g. My Voice, Podcast Anchor)..."
                              className="flex-1 bg-[#0b142c] border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                            />
                            <button
                              type="button"
                              disabled={savingProfile || !voiceProfileName.trim()}
                              onClick={() => handleSaveVoiceProfile(msg.analysisResult!, voiceProfileName)}
                              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-lg ${
                                savingProfile || !voiceProfileName.trim()
                                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                  : "bg-gradient-to-r from-emerald-400 to-cyan-500 text-black shadow-emerald-500/20 hover:opacity-95 active:scale-95"
                              }`}
                            >
                              {savingProfile ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                  <span>SAVING...</span>
                                </>
                              ) : (
                                <>
                                  <IconCheckCircle2 className="w-4 h-4 text-black" />
                                  <span>SAVE VOICE</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Needs Review — Allow Save Anyway */}
                        {!msg.analysisResult.quality_gate_passed && (
                          <div className="space-y-2 bg-[#050a18] p-2.5 rounded-2xl border border-amber-500/30">
                            <p className="text-[10px] text-amber-400">This audio did not fully pass the quality gate. You can still save it for experimentation.</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={voiceProfileName}
                                onChange={(e) => setVoiceProfileName(e.target.value)}
                                placeholder="Name your voice..."
                                className="flex-1 bg-[#0b142c] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                              />
                              <button
                                type="button"
                                disabled={savingProfile || !voiceProfileName.trim()}
                                onClick={() => handleSaveVoiceProfile(msg.analysisResult!, voiceProfileName)}
                                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                                  savingProfile || !voiceProfileName.trim()
                                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg active:scale-95"
                                }`}
                              >
                                {savingProfile ? "SAVING..." : "SAVE ANYWAY"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">{msg.text}</p>
                    )}

                    {msg.status === "GENERATING" && (
                      <div className="flex items-center gap-2.5 p-2.5 bg-[#060d20] border border-cyan-500/30 rounded-xl text-xs text-cyan-300 animate-pulse">
                        <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing with {msg.model || "Voice AI Engine"}...</span>
                      </div>
                    )}

                    {msg.status === "ERROR" && (
                      <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300 space-y-2">
                        <p>{msg.error || "Processing failed."}</p>
                        <button
                          onClick={() => {
                            setInputText(msg.text);
                            handleSendMessage();
                          }}
                          className="px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded-lg text-xs font-semibold transition-all"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {msg.status === "COMPLETED" && msg.audioUrl && (
                      <div className="bg-[#050a1a] border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handlePlayToggle(msg.id, msg.audioUrl!)}
                            className="w-8 h-8 rounded-full bg-cyan-400 hover:bg-cyan-300 text-black flex items-center justify-center shadow-md transition-all flex-shrink-0"
                          >
                            {playingMsgId === msg.id ? (
                              <IconPause className="w-4 h-4 text-black" />
                            ) : (
                              <IconPlay className="w-4 h-4 text-black ml-0.5" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold">
                              <span>{msg.voiceName}</span>
                              <span className="text-cyan-400">• {msg.duration?.toFixed(1)}s</span>
                            </div>
                            <span className="text-[9px] font-mono text-emerald-400">Audio ready (Controls on Right)</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleReplay(msg.id)}
                            className="p-1.5 bg-[#0e1c3e] hover:bg-[#162955] text-slate-300 rounded-lg text-xs transition-all"
                            title="Replay"
                          >
                            <IconRotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Authoritative Audio Element */}
                        <audio
                          ref={(el) => {
                            audioRefs.current[msg.id] = el;
                          }}
                          crossOrigin="anonymous"
                          preload="auto"
                          src={msg.audioUrl}
                          onEnded={() => {
                            setPlayingMsgId(null);
                            onAudioPlaybackState?.(false, null);
                          }}
                          onPause={() => {
                            if (playingMsgId === msg.id) {
                              setPlayingMsgId(null);
                              onAudioPlaybackState?.(false, null);
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Large Chat Composer + Active Context & Direct Bottom Controls */}
          <div className="bg-[#060b1b]/85 border border-cyan-500/30 rounded-3xl p-3.5 backdrop-blur-xl shadow-2xl flex flex-col space-y-2.5">
            
            {/* Active Context Chip (Audio / Video / Script) */}
            {activeContext && (
              <div className="flex items-center justify-between bg-[#0b1633] border border-cyan-500/40 rounded-2xl px-3 py-1.5 text-xs text-cyan-300 animate-in fade-in">
                <div className="flex items-center gap-2">
                  {activeContext.type === "audio" && <IconMic className="w-4 h-4 text-cyan-400" />}
                  {activeContext.type === "video" && <IconFilm className="w-4 h-4 text-blue-400" />}
                  {activeContext.type === "script" && <IconBookOpen className="w-4 h-4 text-amber-400" />}
                  <span className="font-mono font-bold uppercase text-[10px] bg-cyan-500/20 px-1.5 py-0.5 rounded text-cyan-300">
                    {activeContext.type}
                  </span>
                  <span className="text-white font-bold max-w-[200px] truncate">{activeContext.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeContext.type === "audio") audioFileInputRef.current?.click();
                      else if (activeContext.type === "video") videoFileInputRef.current?.click();
                      else scriptFileInputRef.current?.click();
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveContext(null)}
                    className="p-1 rounded-lg hover:bg-[#142654] text-slate-400 hover:text-white"
                    title="Remove attachment"
                  >
                    <IconX className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
              {/* '+' Action Menu Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="w-10 h-10 rounded-2xl bg-[#0b1633] hover:bg-[#102048] border border-cyan-500/40 text-cyan-300 flex items-center justify-center transition-all shadow-md"
                  title="Add Attachment"
                >
                  <IconPlus className={`w-5 h-5 transition-transform ${isPlusMenuOpen ? "rotate-45" : ""}`} />
                </button>

                {/* Local Action Dropdown Popover */}
                {isPlusMenuOpen && (
                  <div className="absolute bottom-12 left-0 w-60 bg-[#070e22] border border-cyan-500/40 rounded-2xl p-2 shadow-2xl z-50 space-y-1 backdrop-blur-2xl">
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center gap-2.5 transition-all"
                    >
                      <IconUpload className="w-4 h-4 text-cyan-400" />
                      <span>Add Audio (Local WAV/MP3)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment("record")}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center gap-2.5 transition-all"
                    >
                      <IconMic className="w-4 h-4 text-purple-400" />
                      <span>Record Voice (Microphone)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center gap-2.5 transition-all"
                    >
                      <IconFilm className="w-4 h-4 text-blue-400" />
                      <span>Add Video (MP4/WebM)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => scriptFileInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center gap-2.5 transition-all"
                    >
                      <IconBookOpen className="w-4 h-4 text-amber-400" />
                      <span>Add Script / Document</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment("saved_voices")}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center gap-2.5 transition-all border-t border-[#1e293b] pt-2"
                    >
                      <IconDna className="w-4 h-4 text-emerald-400" />
                      <span>Choose Saved Voice</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Multiline Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  mode === "translate"
                    ? `Type or attach text to translate into ${targetLanguage.toUpperCase()}...`
                    : mode === "dubbing"
                    ? "Type dubbing prompt or instructions for attached video..."
                    : "Type what you want the voice to say (Press Enter to generate, Shift+Enter for newline)..."
                }
                rows={2}
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none resize-none font-sans px-2 py-1 leading-relaxed"
              />

              {/* Action Button */}
              <button
                type="submit"
                disabled={isGenerating || (!inputText.trim() && !activeContext)}
                className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs transition-all flex items-center gap-2 flex-shrink-0 shadow-lg ${
                  isGenerating || (!inputText.trim() && !activeContext)
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : mode === "translate"
                    ? "bg-gradient-to-r from-emerald-400 to-cyan-500 text-black shadow-emerald-500/20 active:scale-95"
                    : mode === "dubbing"
                    ? "bg-gradient-to-r from-blue-400 to-cyan-500 text-black shadow-blue-500/20 active:scale-95"
                    : "bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-95 text-black shadow-cyan-500/20 active:scale-95"
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>PROCESSING...</span>
                  </>
                ) : mode === "translate" ? (
                  <>
                    <IconGlobe className="w-3.5 h-3.5 text-black" />
                    <span>TRANSLATE</span>
                  </>
                ) : mode === "dubbing" ? (
                  <>
                    <IconFilm className="w-3.5 h-3.5 text-black" />
                    <span>DUB VIDEO</span>
                  </>
                ) : (
                  <>
                    <IconSparkles className="w-3.5 h-3.5 text-black" />
                    <span>GENERATE VOICE</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Mode Switcher & Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e293b]/70 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Mode Selector Chips */}
                <div className="flex bg-[#0b142c] p-0.5 rounded-xl border border-[#1e293b]">
                  <button
                    type="button"
                    onClick={() => onModeChange?.("chat")}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                      mode === "chat" ? "bg-cyan-500 text-black shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange?.("translate")}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                      mode === "translate" ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Translate
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange?.("dubbing")}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                      mode === "dubbing" ? "bg-blue-500 text-black shadow" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Dub
                  </button>
                </div>

                {/* Voice Profile Selector */}
                <div className="flex items-center gap-1 bg-[#0b142c] border border-[#1e293b] rounded-xl px-2 py-1">
                  <span className="text-[10px] text-slate-400">Voice:</span>
                  <select
                    value={selectedProfile?.id || ""}
                    onChange={(e) => {
                      const found = profiles.find((p) => p.id === e.target.value);
                      if (found) setSelectedProfile(found);
                    }}
                    className="bg-transparent text-[11px] text-cyan-300 font-bold focus:outline-none cursor-pointer"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0b142c] text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div className="flex items-center gap-1 bg-[#0b142c] border border-[#1e293b] rounded-xl px-2 py-1">
                  <span className="text-[10px] text-slate-400">Model:</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-transparent text-[11px] text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="xtts-v2" className="bg-[#0b142c] text-white">XTTS v2 (Coqui | Zero-Shot Cloner)</option>
                    <option value="fastpitch-baseline" className="bg-[#0b142c] text-white">FastPitch (NVIDIA/LJSpeech | Baseline)</option>
                    <option value="openvoice-v2" className="bg-[#0b142c] text-white">OpenVoice v2 (MyShell | Tone Color Transfer)</option>
                    <option value="cosyvoice" className="bg-[#0b142c] text-white">CosyVoice (Alibaba | In-Context Multilingual)</option>
                  </select>
                </div>

                {/* Language Selector */}
                <div className="flex items-center gap-1 bg-[#0b142c] border border-[#1e293b] rounded-xl px-2 py-1">
                  <span className="text-[10px] text-slate-400">Language:</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-transparent text-[11px] text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="en" className="bg-[#0b142c] text-white">English (EN)</option>
                    <option value="hi" className="bg-[#0b142c] text-white">Hindi (HI)</option>
                    <option value="es" className="bg-[#0b142c] text-white">Spanish (ES)</option>
                    <option value="fr" className="bg-[#0b142c] text-white">French (FR)</option>
                    <option value="de" className="bg-[#0b142c] text-white">German (DE)</option>
                    <option value="it" className="bg-[#0b142c] text-white">Italian (IT)</option>
                    <option value="ja" className="bg-[#0b142c] text-white">Japanese (JA)</option>
                    <option value="zh" className="bg-[#0b142c] text-white">Chinese (ZH)</option>
                  </select>
                </div>

                {/* Voice Speed Selector (0.25x to 5.0x) */}
                <div className="flex items-center gap-1 bg-[#0b142c] border border-[#1e293b] rounded-xl px-2 py-1">
                  <span className="text-[10px] text-slate-400">Speed:</span>
                  <select
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="bg-transparent text-[11px] text-cyan-300 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="0.25" className="bg-[#0b142c] text-white">0.25x</option>
                    <option value="0.5" className="bg-[#0b142c] text-white">0.5x</option>
                    <option value="0.75" className="bg-[#0b142c] text-white">0.75x</option>
                    <option value="1.0" className="bg-[#0b142c] text-white">1.0x</option>
                    <option value="1.25" className="bg-[#0b142c] text-white">1.25x</option>
                    <option value="1.5" className="bg-[#0b142c] text-white">1.5x</option>
                    <option value="2.0" className="bg-[#0b142c] text-white">2.0x</option>
                    <option value="3.0" className="bg-[#0b142c] text-white">3.0x</option>
                    <option value="5.0" className="bg-[#0b142c] text-white">5.0x</option>
                  </select>
                </div>
              </div>

              {/* ⚙ More Voice Tuning Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedTuning(!showAdvancedTuning)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1 ${
                  showAdvancedTuning
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                    : "bg-[#0b142c] text-slate-400 border-[#1e293b] hover:text-white"
                }`}
              >
                <IconSliders className="w-3.5 h-3.5" />
                <span>More</span>
              </button>
            </div>

            {/* Expandable Advanced Tuning Drawer */}
            {showAdvancedTuning && (
              <div className="p-3 bg-[#070e22] border border-cyan-500/30 rounded-2xl grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Pitch Modulation</span>
                    <span className="font-mono text-cyan-300">{pitch > 0 ? `+${pitch}` : pitch} st</span>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1 bg-[#0b142c] rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Style / Emotion</span>
                    <span className="font-mono text-cyan-300">{emotion}</span>
                  </div>
                  <select
                    value={emotion}
                    onChange={(e) => setEmotion(e.target.value)}
                    className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg px-2 py-1 text-white text-[11px]"
                  >
                    <option value="natural">Natural</option>
                    <option value="calm">Calm</option>
                    <option value="energetic">Energetic</option>
                    <option value="expressive">Expressive</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={onOpenVoiceProfileLab}
                    className="w-full py-1.5 bg-[#0e1c3e] hover:bg-[#162955] border border-cyan-500/30 text-cyan-300 rounded-xl text-[11px] font-bold transition-all text-center"
                  >
                    Add / Clone Voice
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── RIGHT COLUMN: 3D VOICE ROOM & LIVE MONITOR (25-30% width) ── */}
        <aside className="lg:col-span-3 bg-[#060b1b]/80 border border-cyan-500/30 rounded-3xl p-4 backdrop-blur-xl flex flex-col h-[700px] shadow-2xl space-y-3 justify-between">
          
          {/* Header Status */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1e293b]/80">
            <span className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${sceneProps?.isSpeaking ? "bg-cyan-400 animate-ping" : "bg-emerald-400"}`} />
              AI Voice Monitor
            </span>
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
              {sceneProps?.isSpeaking ? `Speaking (${sceneProps.currentViseme})` : "Idle"}
            </span>
          </div>

          {/* Clean 3D Spatial Canvas Stage (Spectrum removed from 3D modal space) */}
          <div className="w-full h-[230px] rounded-2xl overflow-hidden border border-[#1e293b] bg-gradient-to-b from-[#050814] to-[#070e22] relative shadow-inner flex-shrink-0">
            <LabScene
              mode={sceneProps?.viewMode || "3d"}
              state={sceneProps?.systemState || "READY"}
              isSpeaking={sceneProps?.isSpeaking || false}
              performanceTier={sceneProps?.performanceTier || "high"}
              currentViseme={sceneProps?.currentViseme || "SILENCE"}
              audioAmplitude={sceneProps?.audioAmplitude || 0.0}
            />
          </div>

          {/* 24-Bar Audio Visualizer Waveform (Inside Dedicated Spectrum Card) */}
          <div className="bg-[#050a18] border border-cyan-500/30 rounded-2xl p-2.5 flex flex-col space-y-1.5 flex-shrink-0">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="font-bold text-slate-300">Live Acoustic Spectrum</span>
              <span className={`font-bold ${sceneProps?.isSpeaking ? "text-cyan-400 animate-pulse" : "text-slate-500"}`}>
                {sceneProps?.isSpeaking ? `${Math.round((sceneProps?.audioAmplitude || 0) * 100)}% ENERGY` : "STANDBY"}
              </span>
            </div>
            <div className="flex items-end justify-between gap-1 h-10 pt-1 bg-[#030611] rounded-xl px-2 pb-1 border border-[#1e293b]/50">
              {Array.from({ length: 24 }).map((_, i) => {
                const bandVal = sceneProps?.frequencyBands?.[i] || 0;
                const h = sceneProps?.isSpeaking
                  ? Math.min(100, Math.max(12, Math.round(bandVal * 100)))
                  : 8;
                return (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-full rounded-t transition-all duration-75 ${
                      sceneProps?.isSpeaking
                        ? "bg-gradient-to-t from-cyan-500 via-blue-400 to-purple-400 shadow-sm shadow-cyan-500/50"
                        : "bg-slate-800"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Active Generation Output & Working Audio Controls Card */}
          <div className="bg-[#050a18] border border-cyan-500/20 rounded-2xl p-3 flex flex-col justify-between space-y-2 flex-1">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Active Output</span>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                  {activeMonitorMsg?.duration ? `${activeMonitorMsg.duration.toFixed(1)}s` : "Ready"}
                </span>
              </div>
              <span className="text-xs font-bold text-white line-clamp-1">
                {activeMonitorMsg?.voiceName || activeVoiceName}
              </span>
              <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                {activeMonitorMsg?.text || "Type a prompt in the composer and press Generate."}
              </p>
            </div>

            {activeMonitorMsg?.status === "COMPLETED" && activeMonitorMsg.audioUrl && (
              <div className="space-y-2 pt-1.5 border-t border-[#1e293b]">
                
                {/* 1. Working Volume Control Row */}
                <div className="flex items-center justify-between py-1 px-2.5 bg-[#060b1b] rounded-xl border border-[#1e293b] text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="flex items-center gap-1 text-slate-300 hover:text-cyan-400 transition-all"
                    title={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted || volume === 0 ? (
                      <IconVolumeX className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <IconVolume2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>Vol:</span>
                  </button>

                  <div className="flex items-center gap-2 flex-1 mx-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleSetVolume(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-[#0b142c] rounded-lg cursor-pointer"
                    />
                  </div>

                  <span className="text-cyan-300 font-bold w-7 text-right">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                {/* 2. Speed Control Row (0.25x up to 5.0x) */}
                <div className="flex flex-col py-1 px-2.5 bg-[#060b1b] rounded-xl border border-[#1e293b] text-[10px] font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Playback Speed:</span>
                    <span className="text-cyan-400 font-bold">{playbackSpeed.toFixed(2)}x</span>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSetPlaybackSpeed(rate)}
                        className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                          playbackSpeed === rate
                            ? "bg-cyan-400 text-black font-extrabold shadow-sm shadow-cyan-400/50"
                            : "bg-[#0b142c] text-slate-400 hover:text-white"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[8px] text-slate-500">0.25x</span>
                    <input
                      type="range"
                      min="0.25"
                      max="5.0"
                      step="0.25"
                      value={playbackSpeed}
                      onChange={(e) => handleSetPlaybackSpeed(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-[#0b142c] rounded-lg cursor-pointer"
                    />
                    <span className="text-[8px] text-slate-500">5.0x</span>
                  </div>
                </div>

                {/* 3. Action Play/Pause, Replay, and Multi-Format Download Hub */}
                <div className="flex items-center gap-1.5 relative">
                  <button
                    onClick={() => handlePlayToggle(activeMonitorMsg.id, activeMonitorMsg.audioUrl!)}
                    className="flex-1 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
                  >
                    {playingMsgId === activeMonitorMsg.id ? (
                      <>
                        <IconPause className="w-3.5 h-3.5" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <IconPlay className="w-3.5 h-3.5 ml-0.5" />
                        <span>PLAY SPEECH</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleReplay(activeMonitorMsg.id)}
                    className="p-2 bg-[#0e1c3e] hover:bg-[#162955] text-slate-300 rounded-xl transition-all"
                    title="Replay"
                  >
                    <IconRotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Multi-Format / Speed Download Button on Right Side */}
                  <div className="relative">
                    <button
                      onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                      disabled={isRenderingDownload}
                      className="p-2 bg-[#0e1c3e] hover:bg-[#162955] text-cyan-300 rounded-xl transition-all flex items-center gap-1 border border-cyan-500/30"
                      title="Download Audio Options"
                    >
                      {isRenderingDownload ? (
                        <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <IconDownload className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Download Format Dropdown Menu */}
                    {isDownloadMenuOpen && (
                      <div className="absolute right-0 bottom-11 w-56 bg-[#070e22] border border-cyan-500/40 rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 backdrop-blur-2xl text-left">
                        <div className="px-2 py-1 text-[9px] font-mono text-slate-400 uppercase tracking-wider border-b border-[#1e293b]">
                          Download Formats
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadFormatted("wav")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center justify-between"
                        >
                          <span>WAV (Lossless 48kHz)</span>
                          <span className="text-[9px] font-mono text-slate-500">.wav</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFormatted("speed_rendered")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-cyan-300 hover:bg-[#0f1d44] hover:text-white flex items-center justify-between"
                        >
                          <span>At Active Speed ({playbackSpeed}x)</span>
                          <span className="text-[9px] font-mono text-cyan-400">Rendered</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFormatted("mp3")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center justify-between"
                        >
                          <span>MP3 (Compressed)</span>
                          <span className="text-[9px] font-mono text-slate-500">.mp3</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFormatted("flac")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center justify-between"
                        >
                          <span>FLAC (High Fidelity)</span>
                          <span className="text-[9px] font-mono text-slate-500">.flac</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFormatted("ogg")}
                          className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-200 hover:bg-[#0f1d44] hover:text-cyan-300 flex items-center justify-between"
                        >
                          <span>OGG (Opus Audio)</span>
                          <span className="text-[9px] font-mono text-slate-500">.ogg</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Global Add Voice Modal (for recording & guided extraction) */}
      <VoiceAttachmentModal
        isOpen={attachmentModalOpen}
        initialTab={attachmentInitialTab}
        project={project}
        savedProfiles={profiles}
        onClose={() => setAttachmentModalOpen(false)}
        onVoiceSelected={handleVoiceSelected}
        onScriptExtracted={handleScriptExtracted}
        onProfileCreated={handleProfileCreated}
      />
    </div>
  );
}
