"use client";

import React from "react";
import { VoiceAILogo, IconDna, IconBookOpen, IconDatabase, IconSparkles } from "./Icons";

interface LandingHeroProps {
  onEnterLab: () => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

export default function LandingHero({ onEnterLab, onOpenAuth, isAuthenticated }: LandingHeroProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-4xl mx-auto px-6 py-16">
      {/* Brand Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#1e293b] bg-[#0b142c] font-mono text-[12px] text-cyan-400 mb-6 shadow-lg shadow-cyan-500/10">
        <VoiceAILogo className="w-4 h-4" />
        <span>SOLARCH-FIRST PLATFORM • RESEARCH VOICE STUDIO</span>
      </div>

      {/* Main Title */}
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
        Autonomous <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">Voice AI</span> Studio
      </h1>

      {/* Description */}
      <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed font-sans">
        A research-grade Voice AI platform with zero-shot voice cloning (XTTS v2), multi-speaker diarization,
        acoustic profiling, timing adaptation, high-dimensional knowledge memory, and spatial 3D visualization.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={onEnterLab}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-sm shadow-xl shadow-cyan-500/25 transition-all transform hover:scale-105 flex items-center gap-2"
        >
          <IconSparkles className="w-4 h-4 text-black" />
          ENTER VOICE STUDIO
        </button>

        {!isAuthenticated && (
          <button
            onClick={onOpenAuth}
            className="px-7 py-3.5 rounded-xl border border-[#1e293b] bg-[#0b142c] hover:bg-[#162348] text-white font-semibold text-sm transition-all shadow"
          >
            SIGN IN / REGISTER
          </button>
        )}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
        <div className="p-6 rounded-2xl border border-[#1e293b] bg-[#0b142c]/80 hover:border-cyan-500/50 transition-all space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
            <IconDna className="w-4 h-4" />
            <span>Voice Profiling Lab</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Speaker voice identity, timbre MFCC-13, pitch distributions, prosody analysis, and emotion-aware synthesis.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-[#1e293b] bg-[#0b142c]/80 hover:border-purple-500/50 transition-all space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
            <IconBookOpen className="w-4 h-4" />
            <span>Knowledge &amp; Memory</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Transcript indexing, semantic search, and 384-D vector search built into Solarch collections.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-[#1e293b] bg-[#0b142c]/80 hover:border-blue-500/50 transition-all space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
            <IconDatabase className="w-4 h-4" />
            <span>Solarch BaaS Core</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            High-performance SQLite WAL storage, JWT multi-tenant auth, realtime SSE, and 20-tool governance.
          </p>
        </div>
      </div>
    </div>
  );
}
