"use client";

import React from "react";
import { VoiceAILogo, IconZap, IconDna, IconDatabase, IconGlobe, IconFilm, IconBookOpen } from "./Icons";

export default function AboutSection() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="bg-[#0b142c]/90 border border-[#1e293b] rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-3">
        <div className="flex items-center gap-3">
          <VoiceAILogo className="w-10 h-10" />
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide">
              About Autonomous Voice AI Studio
            </h2>
            <p className="text-xs text-cyan-400 font-mono">Solarch-First • TypeScript-First • Neural Voice ML</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed font-sans">
          Autonomous Voice AI Studio is a research-grade, zero-shot voice synthesis and media localization platform.
          It combines high-performance multi-formant acoustic synthesis, multi-speaker diarization, real-time Web Audio API lip-sync,
          and high-dimensional knowledge retrieval into a seamless, modern web experience.
        </p>
      </div>

      {/* Technology Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0b142c]/85 border border-[#1e293b] rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <IconZap className="w-4 h-4" />
            <span>Specialized Neural Voice Engines</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Voice generation uses specialized neural voice models running through our dedicated GPU execution layer.
            Coqui XTTS v2 provides zero-shot cloning, while FastPitch delivers ultra-low latency playback under 50 milliseconds.
          </p>
        </div>

        <div className="bg-[#0b142c]/85 border border-[#1e293b] rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <IconDatabase className="w-4 h-4" />
            <span>Solarch BaaS Platform Core</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All user workspaces, voice profiles, persistent parameter presets, and media assets are governed through Solarch v0.20.3
            with real-time Server-Sent Events (SSE) synchronization and multi-tenant security isolation.
          </p>
        </div>

        <div className="bg-[#0b142c]/85 border border-[#1e293b] rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <IconGlobe className="w-4 h-4" />
            <span>Multilingual Neural Translation</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Integrated NLLB-200 translation pipeline with custom domain glossary protection and timing adaptation ensures accurate
            pronunciation across English, Hindi, Spanish, French, German, and Japanese.
          </p>
        </div>

        <div className="bg-[#0b142c]/85 border border-[#1e293b] rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <IconFilm className="w-4 h-4" />
            <span>Audio Dubbing &amp; 3D Lip-Sync</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Multi-speaker acoustic clustering diarizes interview audio and aligns cloned voice profiles with 40ms equal-power crossfading,
            while the 3D research assistant morphs mouth visemes in real time with Web Audio API FFT analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
