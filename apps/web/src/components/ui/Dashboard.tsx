"use client";

import React, { useEffect, useState, useRef } from "react";
import { solarch, Project, User, VoiceProfileRecord } from "../../lib/solarch";
import VoiceChatStudio from "./VoiceChatStudio";
import AboutModal from "./AboutModal";
import SettingsModal from "./SettingsModal";
import VoiceAttachmentModal from "./VoiceAttachmentModal";
import GlobalCursorTrail from "./GlobalCursorTrail";
import {
  VoiceAILogo,
  IconMic,
  IconGlobe,
  IconFilm,
  IconInfo,
  IconSliders,
  IconMenu,
  IconX,
  IconPlus,
  IconDna
} from "./Icons";

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
}

export type StudioMode = "chat" | "translate" | "dubbing";

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [profiles, setProfiles] = useState<VoiceProfileRecord[]>([]);

  // Studio Experience State
  const [studioMode, setStudioMode] = useState<StudioMode>("chat");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [performanceTier, setPerformanceTier] = useState<"ultra" | "high" | "medium" | "low">("high");
  const [systemState, setSystemState] = useState("READY");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Navigation Drawers & Modals
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGlobalAddOpen, setIsGlobalAddOpen] = useState(false);

  // Audio-reactive & Lip-Sync State
  const [currentViseme, setCurrentViseme] = useState("SILENCE");
  const [audioAmplitude, setAudioAmplitude] = useState(0.0);
  const [frequencyBands, setFrequencyBands] = useState<number[]>(new Array(24).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const attachedSourcesRef = useRef<WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>>(new WeakMap());
  const animFrameRef = useRef<number | null>(null);

  // Mouse Glow Trail Position
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    loadProjects();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const loadProjects = async () => {
    try {
      const items = await solarch.getProjects();
      setProjects(items);
      if (items.length > 0 && !selectedProject) {
        setSelectedProject(items[0]);
        loadProfiles(items[0].id);
      }
    } catch (e) {}
  };

  const loadProfiles = async (projectId: string) => {
    try {
      const items = await solarch.getVoiceProfiles(projectId);
      setProfiles(items);
    } catch (e) {}
  };

  // Direct Audio Volume & Mute Adjuster for Web Audio API GainNode
  const handleAudioVolumeChange = (vol: number, muted: boolean) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0.0 : Math.max(0.0, Math.min(1.0, vol));
    }
  };

  // Audio Playback Listener for Real Audio Lip-Sync & Acoustic Spectrum
  const handleAudioPlaybackState = async (
    playing: boolean,
    audioEl?: HTMLAudioElement | null,
    currentVolume: number = 1.0,
    isCurrentMuted: boolean = false
  ) => {
    setIsSpeaking(playing);

    if (!playing || !audioEl) {
      setCurrentViseme("SILENCE");
      setAudioAmplitude(0.0);
      setFrequencyBands(new Array(24).fill(0));
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (!gainNodeRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = isCurrentMuted ? 0.0 : currentVolume;
        gain.connect(ctx.destination);
        gainNodeRef.current = gain;
      } else {
        gainNodeRef.current.gain.value = isCurrentMuted ? 0.0 : currentVolume;
      }

      const gainNode = gainNodeRef.current;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.75;
        analyser.connect(gainNode);
        analyserRef.current = analyser;
      }

      const analyser = analyserRef.current;

      if (!attachedSourcesRef.current.has(audioEl)) {
        try {
          const source = ctx.createMediaElementSource(audioEl);
          source.connect(analyser);
          attachedSourcesRef.current.set(audioEl, source);
        } catch (srcErr) {
          console.warn("MediaElementAudioSourceNode connection note:", srcErr);
        }
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioAnalysis = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        let avg = sum / bufferLength / 255;

        // Extract 24 Frequency Bands
        const bands: number[] = [];
        const step = Math.max(1, Math.floor(bufferLength / 24));
        for (let b = 0; b < 24; b++) {
          let bandSum = 0;
          for (let k = 0; k < step; k++) {
            bandSum += dataArray[b * step + k] || 0;
          }
          let normalized = bandSum / (step * 255);
          
          if (avg < 0.02 && !audioEl.paused && !audioEl.ended) {
            normalized = 0.25 + 0.35 * Math.sin(b * 0.5 + Date.now() * 0.008);
          }
          bands.push(normalized);
        }

        if (avg < 0.02 && !audioEl.paused && !audioEl.ended) {
          avg = 0.35 + 0.25 * Math.sin(Date.now() * 0.007);
        }

        setAudioAmplitude(avg);
        setFrequencyBands(bands);

        // Sub-Band Viseme Estimation for 3D Lip-Sync
        if (avg < 0.04) {
          setCurrentViseme("SILENCE");
        } else {
          const low = dataArray[2] || 0;
          const mid = dataArray[8] || 0;
          const high = dataArray[16] || 0;

          if (mid > 100) setCurrentViseme("A");
          else if (high > 90) setCurrentViseme("E");
          else if (low > 110) setCurrentViseme("O");
          else setCurrentViseme("U");
        }

        if (audioEl.paused || audioEl.ended) {
          setIsSpeaking(false);
          setCurrentViseme("SILENCE");
          setAudioAmplitude(0.0);
          setFrequencyBands(new Array(24).fill(0));
        } else {
          animFrameRef.current = requestAnimationFrame(updateAudioAnalysis);
        }
      };

      updateAudioAnalysis();
    } catch (e) {
      console.warn("Web Audio analyzer fallback:", e);
      const visemes = ["A", "E", "I", "O", "U"];
      let idx = 0;
      const interval = setInterval(() => {
        if (audioEl.paused || audioEl.ended) {
          clearInterval(interval);
          setIsSpeaking(false);
          setCurrentViseme("SILENCE");
          setAudioAmplitude(0.0);
          setFrequencyBands(new Array(24).fill(0));
        } else {
          setCurrentViseme(visemes[idx % visemes.length]);
          setAudioAmplitude(0.4 + Math.random() * 0.4);
          const fallbackBands = Array.from({ length: 24 }).map((_, i) => 
            0.2 + 0.4 * Math.sin(i * 0.4 + Date.now() * 0.01)
          );
          setFrequencyBands(fallbackBands);
          idx++;
        }
      }, 80);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="w-full min-h-screen bg-[#050814] text-slate-100 relative overflow-x-hidden selection:bg-cyan-500 selection:text-black font-sans"
    >
      {/* Global Spectrum Cursor Trail & Click Ripple */}
      <GlobalCursorTrail />

      {/* Interactive Glowing Ambient Background Cursor */}
      <div
        className="pointer-events-none fixed w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl transition-transform duration-75 ease-out -translate-x-1/2 -translate-y-1/2 z-0"
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      />

      {/* ── MINIMAL CONSUMER HEADER ── */}
      <header className="sticky top-0 z-40 bg-[#050814]/85 backdrop-blur-xl border-b border-[#1e293b] px-4 sm:px-6 py-3 flex justify-between items-center">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <VoiceAILogo className="w-8 h-8 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-white">VOICE AI</h1>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              STUDIO
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 3D vs 2D Toggle */}
          <div className="flex bg-[#0b142c] rounded-xl border border-[#1e293b] p-0.5 text-xs">
            <button
              onClick={() => setViewMode("3d")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                viewMode === "3d" ? "bg-cyan-500 text-black shadow font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              3D Room
            </button>
            <button
              onClick={() => setViewMode("2d")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                viewMode === "2d" ? "bg-cyan-500 text-black shadow font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              2D HUD
            </button>
          </div>

          {/* Menu / Sidebar Trigger Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-xl bg-[#0b142c] hover:bg-[#16244d] border border-cyan-500/30 text-cyan-300 transition-all flex items-center gap-1.5 text-xs font-bold shadow"
            title="Menu & Modes"
          >
            <IconMenu className="w-4 h-4" />
            <span className="hidden sm:inline">Menu</span>
          </button>

          {/* Sign Out */}
          <button
            onClick={onLogout}
            className="px-3 py-1.5 bg-[#0b142c] hover:bg-[#18264e] text-[11px] text-red-400 border border-[#1e293b] rounded-xl font-bold transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── SLIDE-OUT SIDEBAR DRAWER ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-80 max-w-[85vw] h-full bg-[#070e22] border-l border-cyan-500/30 p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-250">
            
            {/* Drawer Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
                <div className="flex items-center gap-2.5">
                  <VoiceAILogo className="w-7 h-7" />
                  <span className="text-sm font-extrabold text-white">Voice AI Menu</span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-xl bg-[#0b142c] hover:bg-[#142246] text-slate-400 hover:text-white transition-all"
                >
                  <IconX className="w-4 h-4" />
                </button>
              </div>

              {/* Action Links */}
              <div className="space-y-1.5 text-xs font-bold">
                <button
                  onClick={() => {
                    setStudioMode("chat");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all text-left ${
                    studioMode === "chat"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/20"
                      : "bg-[#0b142c] text-slate-200 hover:bg-[#12224d]"
                  }`}
                >
                  <IconMic className="w-4 h-4" />
                  <div>
                    <div>Voice Chat Studio</div>
                    <div className={`text-[10px] font-normal ${studioMode === "chat" ? "text-black/80" : "text-slate-400"}`}>
                      Main speech synthesis center
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStudioMode("translate");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all text-left ${
                    studioMode === "translate"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/20"
                      : "bg-[#0b142c] text-slate-200 hover:bg-[#12224d]"
                  }`}
                >
                  <IconGlobe className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div>Translate Speech</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Multilingual cross-voice translation
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStudioMode("dubbing");
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all text-left ${
                    studioMode === "dubbing"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/20"
                      : "bg-[#0b142c] text-slate-200 hover:bg-[#12224d]"
                  }`}
                >
                  <IconFilm className="w-4 h-4 text-blue-400" />
                  <div>
                    <div>Video Dubbing</div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      Voice isolation and re-dubbing
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="space-y-2 pt-4 border-t border-[#1e293b] text-xs font-bold">
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#0b142c] hover:bg-[#12224d] text-slate-300 flex items-center gap-2.5 transition-all"
              >
                <IconSliders className="w-4 h-4 text-cyan-400" />
                <span>Preferences & Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  setIsAboutOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#0b142c] hover:bg-[#12224d] text-slate-300 flex items-center gap-2.5 transition-all"
              >
                <IconInfo className="w-4 h-4 text-amber-400" />
                <span>About Voice AI</span>
              </button>

              <button
                onClick={onLogout}
                className="w-full py-2.5 px-3 rounded-xl bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-800/40 flex items-center justify-center gap-2 transition-all mt-2"
              >
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CHAT-ONLY VIEWPORT ── */}
      <main className="max-w-[1680px] mx-auto p-4 sm:p-6 relative z-10">
        <div className="relative z-20 w-full pt-1">
          <VoiceChatStudio
            project={selectedProject}
            mode={studioMode}
            onModeChange={setStudioMode}
            sceneProps={{
              viewMode,
              performanceTier,
              currentViseme,
              audioAmplitude,
              frequencyBands,
              isSpeaking,
              systemState
            }}
            onAudioPlaybackState={handleAudioPlaybackState}
            onVolumeChange={handleAudioVolumeChange}
            onOpenVoiceProfileLab={() => setIsGlobalAddOpen(true)}
          />
        </div>
      </main>

      {/* ── CONSUMER MODALS ── */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        viewMode={viewMode}
        onSetViewMode={setViewMode}
      />

      {/* Global Add Voice Modal */}
      <VoiceAttachmentModal
        isOpen={isGlobalAddOpen}
        initialTab="audio"
        project={selectedProject}
        savedProfiles={profiles}
        onClose={() => setIsGlobalAddOpen(false)}
        onVoiceSelected={() => {}}
        onScriptExtracted={() => {}}
        onProfileCreated={(newP) => setProfiles((prev) => [newP, ...prev])}
      />
    </div>
  );
}
