"use client";

import React, { useState } from "react";
import { IconX, IconSliders, IconCheckCircle2 } from "./Icons";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: "3d" | "2d";
  onSetViewMode: (mode: "3d" | "2d") => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  viewMode,
  onSetViewMode
}: SettingsModalProps) {
  const [audioQuality, setAudioQuality] = useState("high");
  const [defaultSpeed, setDefaultSpeed] = useState("1.0");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoPlaySpeech, setAutoPlaySpeech] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#070e22] border border-cyan-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <IconSliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Voice AI Settings</h2>
              <p className="text-[11px] text-slate-400 font-mono">Preferences & Experience</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0b142c] hover:bg-[#16244d] text-slate-400 hover:text-white transition-all"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-4 text-xs">
          
          {/* Visual Experience */}
          <div className="space-y-2">
            <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              Visual Experience
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSetViewMode("3d")}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  viewMode === "3d"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black border-cyan-400 shadow-md shadow-cyan-500/20"
                    : "bg-[#0b142c] border-[#1e293b] text-slate-300 hover:bg-[#112048]"
                }`}
              >
                3D Avatar Room
              </button>
              <button
                type="button"
                onClick={() => onSetViewMode("2d")}
                className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                  viewMode === "2d"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black border-cyan-400 shadow-md shadow-cyan-500/20"
                    : "bg-[#0b142c] border-[#1e293b] text-slate-300 hover:bg-[#112048]"
                }`}
              >
                2D Lightweight HUD
              </button>
            </div>
          </div>

          {/* Default Playback Speed */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              Default Voice Speed
            </label>
            <select
              value={defaultSpeed}
              onChange={(e) => setDefaultSpeed(e.target.value)}
              className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="0.75">0.75x (Relaxed)</option>
              <option value="1.0">1.0x (Standard)</option>
              <option value="1.25">1.25x (Upbeat)</option>
              <option value="1.5">1.5x (Fast)</option>
              <option value="2.0">2.0x (Brisk)</option>
            </select>
          </div>

          {/* Audio Quality Tier */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold uppercase tracking-wider text-[10px]">
              Audio Fidelity
            </label>
            <select
              value={audioQuality}
              onChange={(e) => setAudioQuality(e.target.value)}
              className="w-full bg-[#0b142c] border border-[#1e293b] rounded-xl px-3 py-2 text-white font-bold focus:outline-none cursor-pointer"
            >
              <option value="high">High Definition (48kHz Lossless WAV)</option>
              <option value="standard">Standard (Compressed 24kHz)</option>
            </select>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-1 border-t border-[#1e293b]">
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-slate-200 font-semibold block">Auto-Play Generated Speech</span>
                <span className="text-[10px] text-slate-500">Play newly synthesized voice automatically</span>
              </div>
              <input
                type="checkbox"
                checked={autoPlaySpeech}
                onChange={(e) => setAutoPlaySpeech(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-slate-200 font-semibold block">Reduced Motion</span>
                <span className="text-[10px] text-slate-500">Disable background particle glow effects</span>
              </div>
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e293b]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0b142c] hover:bg-[#16244d] text-slate-300 rounded-xl text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-95 text-black font-extrabold rounded-xl text-xs shadow transition-all flex items-center gap-1.5"
          >
            {savedToast ? (
              <>
                <IconCheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
