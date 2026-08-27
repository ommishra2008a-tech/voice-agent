"use client";

import React from "react";
import { IconX, IconInfo, VoiceAILogo, IconMic, IconGlobe, IconFilm, IconSparkles } from "./Icons";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#070e22] border border-cyan-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <VoiceAILogo className="w-9 h-9 flex-shrink-0" />
            <div>
              <h2 className="text-base font-extrabold text-white">About Voice AI</h2>
              <p className="text-[11px] text-cyan-400 font-mono">Next-Generation Voice AI Studio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0b142c] hover:bg-[#16244d] text-slate-400 hover:text-white transition-all"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed max-h-[420px] overflow-y-auto pr-1">
          <p>
            <strong className="text-white">Voice AI Studio</strong> is an all-in-one neural voice creation platform designed to synthesize lifelike, expressive human speech from text, clone custom voices with zero-shot conditioning, and perform real-time multilingual translation and dubbing.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 bg-[#0b142c] border border-cyan-500/20 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                <IconMic className="w-4 h-4 text-cyan-400" />
                <span>Zero-Shot Voice Cloning</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Provide a short 3-10s audio reference to clone your own voice and synthesize any script with authentic timbre and cadence.
              </p>
            </div>

            <div className="p-3 bg-[#0b142c] border border-cyan-500/20 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <IconGlobe className="w-4 h-4 text-emerald-400" />
                <span>Multilingual Translation</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Translate scripts into 16+ languages (English, Hindi, Spanish, French, German, Japanese, Chinese) preserving original voice identity.
              </p>
            </div>

            <div className="p-3 bg-[#0b142c] border border-cyan-500/20 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                <IconFilm className="w-4 h-4 text-blue-400" />
                <span>Video Dubbing</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Isolate speakers from video files and re-voice media across languages with synchronized speech timing and natural emotion.
              </p>
            </div>

            <div className="p-3 bg-[#0b142c] border border-cyan-500/20 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                <IconSparkles className="w-4 h-4 text-purple-400" />
                <span>3D Spatial Monitoring</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time audio-reactive 3D Cyber Face with responsive mouth viseme lip-sync and 24-band frequency spectrum telemetry.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#040817] border border-[#1e293b] rounded-2xl text-[11px] text-slate-400">
            <span className="text-white font-bold block mb-0.5">Engine Support</span>
            XTTS v2 (Coqui Neural Cloner), FastPitch (Low-latency baseline), OpenVoice v2 (Tone color converter), and CosyVoice (In-context multilingual synthesis).
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-[#1e293b]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-95 text-black font-extrabold rounded-xl text-xs shadow transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
