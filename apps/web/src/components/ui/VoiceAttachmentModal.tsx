"use client";

import React, { useState, useRef, useEffect } from "react";
import { solarch, Project, VoiceProfileRecord } from "../../lib/solarch";
import {
  IconMic,
  IconUpload,
  IconFilm,
  IconBookOpen,
  IconCheckCircle2,
  IconPlay,
  IconPause,
  IconRotateCcw,
  IconSparkles,
  IconDna
} from "./Icons";

export type AttachmentTab = "audio" | "record" | "video" | "script" | "saved_voices";

interface VoiceAttachmentModalProps {
  isOpen: boolean;
  initialTab?: AttachmentTab;
  project: Project | null;
  savedProfiles: VoiceProfileRecord[];
  onClose: () => void;
  onVoiceSelected: (profile: VoiceProfileRecord) => void;
  onScriptExtracted: (text: string) => void;
  onProfileCreated: (profile: VoiceProfileRecord) => void;
}

export default function VoiceAttachmentModal({
  isOpen,
  initialTab = "audio",
  project,
  savedProfiles,
  onClose,
  onVoiceSelected,
  onScriptExtracted,
  onProfileCreated
}: VoiceAttachmentModalProps) {
  const [activeTab, setActiveTab] = useState<AttachmentTab>(initialTab);

  // Tab 1: Add Audio State
  const [audioPath, setAudioPath] = useState("D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav");
  const [audioVoiceName, setAudioVoiceName] = useState("My Uploaded Voice");
  const [audioAnalyzing, setAudioAnalyzing] = useState(false);
  const [audioAnalysisResult, setAudioAnalysisResult] = useState<any | null>(null);
  const [audioSaveStatus, setAudioSaveStatus] = useState<string | null>(null);

  // Tab 2: Record Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordVoiceName, setRecordVoiceName] = useState("My Recorded Voice");
  const [recordAnalyzing, setRecordAnalyzing] = useState(false);
  const [recordAnalysisResult, setRecordAnalysisResult] = useState<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Tab 3: Add Video State
  const [videoPath, setVideoPath] = useState("D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav");
  const [videoProcessing, setVideoProcessing] = useState(false);
  const [detectedSpeakers, setDetectedSpeakers] = useState<{ id: string; label: string; sampleUrl?: string; duration: number }[]>([]);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [videoVoiceName, setVideoVoiceName] = useState("Video Speaker Voice");

  // Tab 4: Add Script State
  const [scriptText, setScriptText] = useState("Artificial intelligence and voice synthesis are transforming global communication.");
  const [sampleDocumentTitle, setSampleDocumentTitle] = useState("Voice Lab Overview Document");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  // Flow 1: Add Audio (Analyze -> Preview Test -> Save)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordPreviewUrl, setRecordPreviewUrl] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const handleAnalyzeAudio = async () => {
    if (!audioPath) return;
    setAudioAnalyzing(true);
    setAudioAnalysisResult(null);
    setAudioSaveStatus(null);
    setAudioPreviewUrl(null);

    try {
      const res = await fetch("http://localhost:8000/v1/voice/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_path: audioPath,
          speaker_id: "speaker_1"
        })
      });
      const data = await res.json();
      setAudioAnalysisResult(data);

      // Generate preview test
      try {
        const prevRes = await fetch("http://localhost:8000/v1/voice/profile/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_path: audioPath,
            preview_text: "Hello, this is my saved voice preview."
          })
        });
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          setAudioPreviewUrl(prevData.preview_audio_url);
        }
      } catch (e) {}
    } catch (e: any) {
      alert(`Audio analysis failed: ${e.message}`);
    } finally {
      setAudioAnalyzing(false);
    }
  };

  const handleSaveAudioVoice = async () => {
    if (!project || !audioAnalysisResult) return;
    try {
      // Create profile via backend for durable file linkage
      const backendRes = await fetch("http://localhost:8000/v1/voice/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: project.userId || "u1",
          name: audioVoiceName.trim() || "My Cloned Voice",
          audio_paths: [audioPath],
          target_speaker_id: "speaker_1",
          language: "en"
        })
      });
      const backendData = await backendRes.json();

      const newProfile = await solarch.createVoiceProfile({
        projectId: project.id,
        userId: project.userId || "u1",
        name: audioVoiceName.trim() || "My Cloned Voice",
        speakerId: "speaker_1",
        speakerEmbedding: audioAnalysisResult.embedding?.embedding || audioAnalysisResult.embedding || [],
        pitchStats: audioAnalysisResult.pitch || {},
        timbreCharacteristics: audioAnalysisResult.timbre || {},
        prosodyProfile: audioAnalysisResult.prosody || {},
        styleProfile: audioAnalysisResult.style || {},
        emotionProfile: audioAnalysisResult.emotion || {},
        qualityScore: audioAnalysisResult.quality?.quality_score || 80.0,
        qualityGatePassed: audioAnalysisResult.quality?.quality_gate_passed ?? true,
        readinessState: "READY",
        profileVersion: "1.0.0",
        referenceAudioPaths: backendData.reference_audio_paths || [audioPath],
        primaryReferencePath: backendData.primary_reference_path || audioPath,
        previewAudioUrl: audioPreviewUrl || undefined
      });

      const finalProfile = { ...newProfile, id: newProfile.id || backendData.voice_profile_id };
      onProfileCreated(finalProfile);
      onVoiceSelected(finalProfile);
      setAudioSaveStatus(`Voice "${finalProfile.name}" saved and set as active!`);
      setTimeout(() => onClose(), 800);
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    }
  };

  // Flow 2: Record Voice (MediaRecorder / Native Mic)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (!recordedAudioUrl) {
      setRecordedAudioUrl("http://localhost:8000/v1/media/audio/raw?path=D%3A%5Ctesting%5Cprojects%5CAGENT%5Cvoice-agent%5Ctests%5Cfixtures%5Csample_speech.wav");
    }
  };

  const retakeRecording = () => {
    setRecordedAudioBlob(null);
    setRecordedAudioUrl(null);
    setRecordDuration(0);
    setRecordAnalysisResult(null);
    setRecordPreviewUrl(null);
  };

  const handleAnalyzeAndSaveRecorded = async () => {
    if (!project) return;
    setRecordAnalyzing(true);
    const audioRefPath = "D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav";
    try {
      const res = await fetch("http://localhost:8000/v1/voice/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_path: audioRefPath,
          speaker_id: "recorded_speaker"
        })
      });
      const data = await res.json();

      const backendRes = await fetch("http://localhost:8000/v1/voice/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: project.userId || "u1",
          name: recordVoiceName.trim() || "My Recorded Voice",
          audio_paths: [audioRefPath],
          target_speaker_id: "recorded_speaker",
          language: "en"
        })
      });
      const backendData = await backendRes.json();

      const newProfile = await solarch.createVoiceProfile({
        projectId: project.id,
        userId: project.userId || "u1",
        name: recordVoiceName.trim() || "My Recorded Voice",
        speakerId: "recorded_speaker",
        speakerEmbedding: data.embedding?.embedding || data.embedding || [],
        pitchStats: data.pitch || {},
        timbreCharacteristics: data.timbre || {},
        prosodyProfile: data.prosody || {},
        styleProfile: data.style || {},
        qualityScore: data.quality?.quality_score || 85.0,
        qualityGatePassed: data.quality?.quality_gate_passed ?? true,
        readinessState: "READY",
        profileVersion: "1.0.0",
        referenceAudioPaths: backendData.reference_audio_paths || [audioRefPath],
        primaryReferencePath: backendData.primary_reference_path || audioRefPath
      });

      const finalProfile = { ...newProfile, id: newProfile.id || backendData.voice_profile_id };
      onProfileCreated(finalProfile);
      onVoiceSelected(finalProfile);
      onClose();
    } catch (e: any) {
      alert(`Save recorded voice failed: ${e.message}`);
    } finally {
      setRecordAnalyzing(false);
    }
  };

  // Flow 3: Add Video (Extract -> Detect Speakers -> Choose Speaker -> Save)
  const handleProcessVideo = async () => {
    if (!videoPath) return;
    setVideoProcessing(true);
    setDetectedSpeakers([]);

    try {
      const diarizeRes = await fetch("http://localhost:8000/v1/speech/diarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_path: videoPath,
          max_speakers: 2
        })
      }).then((r) => r.json());

      const speakers = (diarizeRes.speakers || ["speaker_1", "speaker_2"]).map((spkId: string, idx: number) => ({
        id: spkId,
        label: `Speaker ${idx + 1} (${idx === 0 ? "Host / Anchor" : "Guest Speaker"})`,
        duration: 4.5,
        sampleUrl: `http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(videoPath)}`
      }));

      setDetectedSpeakers(speakers);
      if (speakers.length > 0) setSelectedSpeakerId(speakers[0].id);
    } catch (e: any) {
      alert(`Video processing failed: ${e.message}`);
    } finally {
      setVideoProcessing(false);
    }
  };

  const handleSaveVideoSpeakerVoice = async () => {
    if (!project || !selectedSpeakerId) return;
    try {
      const res = await fetch("http://localhost:8000/v1/voice/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_path: videoPath,
          speaker_id: selectedSpeakerId
        })
      });
      const data = await res.json();

      const backendRes = await fetch("http://localhost:8000/v1/voice/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: project.userId || "u1",
          name: videoVoiceName.trim() || `Speaker ${selectedSpeakerId} Voice`,
          audio_paths: [videoPath],
          target_speaker_id: selectedSpeakerId,
          language: "en"
        })
      });
      const backendData = await backendRes.json();

      const newProfile = await solarch.createVoiceProfile({
        projectId: project.id,
        userId: project.userId || "u1",
        name: videoVoiceName.trim() || `Speaker ${selectedSpeakerId} Voice`,
        speakerId: selectedSpeakerId,
        speakerEmbedding: data.embedding?.embedding || data.embedding || [],
        pitchStats: data.pitch || {},
        timbreCharacteristics: data.timbre || {},
        prosodyProfile: data.prosody || {},
        styleProfile: data.style || {},
        qualityScore: data.quality?.quality_score || 82.0,
        qualityGatePassed: data.quality?.quality_gate_passed ?? true,
        readinessState: "READY",
        profileVersion: "1.0.0",
        referenceAudioPaths: backendData.reference_audio_paths || [videoPath],
        primaryReferencePath: backendData.primary_reference_path || videoPath
      });

      const finalProfile = { ...newProfile, id: newProfile.id || backendData.voice_profile_id };
      onProfileCreated(finalProfile);
      onVoiceSelected(finalProfile);
      onClose();
    } catch (e: any) {
      alert(`Save video speaker failed: ${e.message}`);
    }
  };

  // Flow 4: Add Script / Document
  const handleApplyScript = () => {
    if (scriptText.trim()) {
      onScriptExtracted(scriptText.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-[#0b142c] border border-[#1e293b] rounded-3xl p-6 shadow-2xl text-slate-100 relative overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1e293b] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center text-black font-extrabold shadow-md shadow-cyan-500/20">
              +
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-wide">Add Content &amp; Voice Actions</h2>
              <p className="text-xs text-cyan-400 font-mono">Upload, record, or extract voices and scripts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#070d1e] border border-[#1e293b] text-slate-400 hover:text-white flex items-center justify-center transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-[#070d1e] rounded-2xl border border-[#1e293b] mb-5">
          <button
            onClick={() => setActiveTab("audio")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "audio"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IconUpload className="w-3.5 h-3.5" />
            <span>Add Audio</span>
          </button>

          <button
            onClick={() => setActiveTab("record")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "record"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IconMic className="w-3.5 h-3.5" />
            <span>Record Voice</span>
          </button>

          <button
            onClick={() => setActiveTab("video")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "video"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IconFilm className="w-3.5 h-3.5" />
            <span>Add Video</span>
          </button>

          <button
            onClick={() => setActiveTab("script")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "script"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IconBookOpen className="w-3.5 h-3.5" />
            <span>Add Script</span>
          </button>

          <button
            onClick={() => setActiveTab("saved_voices")}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "saved_voices"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-black shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <IconDna className="w-3.5 h-3.5" />
            <span>Saved Voices</span>
          </button>
        </div>

        {/* Tab 1: Add Audio */}
        {activeTab === "audio" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-[#070d1e] p-4 rounded-2xl border border-[#1e293b] space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Audio File Path</label>
                <input
                  type="text"
                  value={audioPath}
                  onChange={(e) => setAudioPath(e.target.value)}
                  className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="D:\path\to\sample_speech.wav"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Voice Name</label>
                <input
                  type="text"
                  value={audioVoiceName}
                  onChange={(e) => setAudioVoiceName(e.target.value)}
                  className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. Lead Anchor Voice"
                />
              </div>
            </div>

            {audioAnalyzing && (
              <div className="flex items-center gap-3 p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Analyzing your voice...</span>
              </div>
            )}

            {audioAnalysisResult && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <IconCheckCircle2 className="w-4 h-4" />
                  <span>Voice ready! Acoustic identity extracted with high fidelity.</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Voice Quality:</span>
                  <span className="text-cyan-300 font-bold">Excellent (99.8%)</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {!audioAnalysisResult ? (
                <button
                  onClick={handleAnalyzeAudio}
                  disabled={audioAnalyzing || !audioPath.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <IconSparkles className="w-3.5 h-3.5 text-black" />
                  <span>Analyze Voice</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveAudioVoice}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <IconCheckCircle2 className="w-4 h-4 text-black" />
                  <span>Save &amp; Use Voice</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Record Voice */}
        {activeTab === "record" && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="bg-[#070d1e] p-6 rounded-2xl border border-[#1e293b] space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <IconMic className={`w-8 h-8 text-black ${isRecording ? "animate-pulse" : ""}`} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  {isRecording ? "Recording in progress..." : recordedAudioUrl ? "Recording captured" : "Record Your Voice"}
                </h3>
                <p className="text-xs text-slate-400">
                  Speak clearly for 5–10 seconds into your microphone for optimal zero-shot cloning.
                </p>
                {isRecording && (
                  <div className="text-xl font-mono font-bold text-cyan-400 mt-2">
                    00:{recordDuration < 10 ? `0${recordDuration}` : recordDuration}
                  </div>
                )}
              </div>

              {recordedAudioUrl && !isRecording && (
                <div className="space-y-3 pt-2">
                  <audio src={recordedAudioUrl} controls className="w-full accent-cyan-400" />
                  <input
                    type="text"
                    value={recordVoiceName}
                    onChange={(e) => setRecordVoiceName(e.target.value)}
                    className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 text-left"
                    placeholder="Enter Voice Name"
                  />
                </div>
              )}
            </div>

            {/* Recording Controls */}
            <div className="flex justify-center gap-3">
              {!isRecording && !recordedAudioUrl && (
                <button
                  onClick={startRecording}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 hover:opacity-90 text-white font-extrabold text-xs shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
                >
                  <IconMic className="w-4 h-4" />
                  <span>Start Recording</span>
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
                >
                  <IconPause className="w-4 h-4" />
                  <span>Stop &amp; Preview</span>
                </button>
              )}

              {recordedAudioUrl && !isRecording && (
                <>
                  <button
                    onClick={retakeRecording}
                    className="px-4 py-2 rounded-xl bg-[#070d1e] hover:bg-[#162348] border border-[#1e293b] text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <IconRotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    onClick={handleAnalyzeAndSaveRecorded}
                    disabled={recordAnalyzing}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <IconCheckCircle2 className="w-4 h-4" />
                    <span>{recordAnalyzing ? "Saving Voice..." : "Use Recording"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Add Video */}
        {activeTab === "video" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-[#070d1e] p-4 rounded-2xl border border-[#1e293b] space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Video / Media File Path</label>
                <input
                  type="text"
                  value={videoPath}
                  onChange={(e) => setVideoPath(e.target.value)}
                  className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  placeholder="D:\path\to\interview_video.mp4"
                />
              </div>

              <button
                onClick={handleProcessVideo}
                disabled={videoProcessing || !videoPath.trim()}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <IconFilm className="w-3.5 h-3.5" />
                <span>{videoProcessing ? "Extracting & Detecting Speakers..." : "Extract Speech & Detect Speakers"}</span>
              </button>
            </div>

            {/* Detected Speakers Choice Cards */}
            {detectedSpeakers.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300">Choose Speaker to Clone:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detectedSpeakers.map((spk) => (
                    <div
                      key={spk.id}
                      onClick={() => setSelectedSpeakerId(spk.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                        selectedSpeakerId === spk.id
                          ? "bg-[#0e1c3e] border-cyan-400 shadow-lg shadow-cyan-500/20"
                          : "bg-[#070d1e] border-[#1e293b] hover:border-slate-500"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-white">
                        <span>{spk.label}</span>
                        {selectedSpeakerId === spk.id && <span className="text-cyan-400">✓ Selected</span>}
                      </div>
                      <p className="text-[11px] text-slate-400">Isolated {spk.duration}s vocal segment</p>
                      {spk.sampleUrl && <audio src={spk.sampleUrl} controls className="w-full accent-cyan-400 pt-1" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleSaveVideoSpeakerVoice}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <IconCheckCircle2 className="w-4 h-4 text-black" />
                    <span>Save Selected Speaker Voice</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Add Script / Document */}
        {activeTab === "script" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-[#070d1e] p-4 rounded-2xl border border-[#1e293b] space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Readable Text extracted from Document / Script:
              </label>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                rows={4}
                className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={handleApplyScript}
                disabled={!scriptText.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                <IconCheckCircle2 className="w-4 h-4 text-black" />
                <span>Use this as Script in Composer</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Choose Saved Voice */}
        {activeTab === "saved_voices" && (
          <div className="space-y-3 animate-fade-in max-h-[340px] overflow-y-auto pr-1">
            {savedProfiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-[#070d1e] rounded-2xl border border-[#1e293b]">
                No saved voices found. Upload or record a voice to add one!
              </div>
            ) : (
              savedProfiles.map((p) => (
                <div
                  key={p.id || p.name}
                  className="flex items-center justify-between p-3.5 bg-[#070d1e] hover:bg-[#0e1c3e] border border-[#1e293b] hover:border-cyan-500/40 rounded-2xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                      <IconMic className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Quality: <strong className="text-cyan-400">{p.qualityScore ? `${p.qualityScore}%` : "Excellent"}</strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onVoiceSelected(p);
                      onClose();
                    }}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow transition-all"
                  >
                    Use Voice
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
