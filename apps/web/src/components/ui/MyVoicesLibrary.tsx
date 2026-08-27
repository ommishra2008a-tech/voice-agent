"use client";

import React, { useState, useEffect } from "react";
import { solarch, Project, VoiceProfileRecord } from "../../lib/solarch";
import {
  IconMic,
  IconDna,
  IconUpload,
  IconPlay,
  IconCheckCircle2,
  IconTrash,
  IconSparkles,
  IconSliders
} from "./Icons";

interface MyVoicesLibraryProps {
  project: Project | null;
  onSelectVoice?: (profile: VoiceProfileRecord) => void;
  onOpenAddModal?: () => void;
}

export default function MyVoicesLibrary({
  project,
  onSelectVoice,
  onOpenAddModal
}: MyVoicesLibraryProps) {
  const [profiles, setProfiles] = useState<VoiceProfileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (project) loadProfiles();
  }, [project]);

  const loadProfiles = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const items = await solarch.getVoiceProfiles(project.id);
      setProfiles(items);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Library Header */}
      <div className="bg-[#0b142c]/90 border border-[#1e293b] rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <IconDna className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-wide">My Voice Library</h2>
            <p className="text-xs text-slate-400">Manage, preview, and select your cloned voice identities.</p>
          </div>
        </div>

        <button
          onClick={onOpenAddModal}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
        >
          <IconUpload className="w-4 h-4 text-black" />
          <span>+ Add New Voice</span>
        </button>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-[#070d1e]/80 rounded-3xl border border-[#1e293b] space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#0e1a38] text-cyan-400 flex items-center justify-center">
              <IconMic className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Voices in Library</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Upload an audio sample, record with your microphone, or extract a speaker from a video to build your voice library.
            </p>
            <button
              onClick={onOpenAddModal}
              className="mt-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow transition-all inline-flex items-center gap-1.5"
            >
              + Create First Voice
            </button>
          </div>
        ) : (
          profiles.map((profile, idx) => (
            <div
              key={profile.id || profile.name}
              className="bg-[#0b142c]/95 border border-[#1e293b] hover:border-cyan-500/50 rounded-3xl p-5 shadow-2xl space-y-4 transition-all hover:shadow-cyan-500/10 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Card Top */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{profile.name}</h3>
                      <span className="text-[10px] font-mono text-cyan-400">XTTS v2 Cloner Ready</span>
                    </div>
                  </div>

                {/* Quality & Readiness Pill */}
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#0b142c] text-cyan-300 border border-cyan-500/30">
                      v{profile.profileVersion || "1.0.0"}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                      profile.qualityGatePassed !== false
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${profile.qualityGatePassed !== false ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                      <span>{profile.qualityGatePassed !== false ? "Ready" : "Review"}</span>
                    </span>
                  </div>
                </div>

                {/* Simulated Mini-Waveform */}
                <div className="h-10 bg-[#070d1e] rounded-xl border border-[#1e293b] flex items-center justify-center px-3 gap-0.5 overflow-hidden">
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div
                      key={i}
                      style={{ height: `${20 + ((i * 7) % 65)}%` }}
                      className="w-1 bg-[#1e293b] hover:bg-cyan-400 rounded-full transition-all"
                    />
                  ))}
                </div>

                {/* Meta details */}
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Score: {profile.qualityScore != null ? `${profile.qualityScore}/100` : "Calculated"}</span>
                  <span>Lang: {(profile.language || "en").toUpperCase()}</span>
                </div>

                {/* Collapsible Technical Details */}
                <div>
                  <button
                    onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id || profile.name)}
                    className="text-[10px] text-slate-500 hover:text-cyan-400 font-mono transition-all flex items-center gap-1"
                  >
                    <span>{expandedId === profile.id ? "Hide Acoustic Data" : "View Acoustic Profile"}</span>
                    <span>{expandedId === profile.id ? "▲" : "▼"}</span>
                  </button>

                  {expandedId === (profile.id || profile.name) && (
                    <div className="mt-2 p-3 bg-[#060b1b] rounded-xl border border-[#1e293b] text-[10px] font-mono text-slate-400 space-y-1 animate-fade-in">
                      <div className="flex justify-between">
                        <span>Fingerprint:</span>
                        <span className="text-white">{profile.encoderVersion || "spectral-fingerprint-v1.0.0"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pitch F0 Mean:</span>
                        <span className="text-cyan-400">{profile.pitchStats?.f0_mean ? `${Number(profile.pitchStats.f0_mean).toFixed(1)} Hz` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calculated Quality:</span>
                        <span className="text-emerald-400">{profile.qualityScore != null ? `${profile.qualityScore}/100` : "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Analysis Ver:</span>
                        <span className="text-slate-300">{profile.analysisVersion || "phase12a"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#1e293b] flex items-center justify-between gap-2">
                {profile.previewAudioUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const audio = new Audio(profile.previewAudioUrl);
                      audio.play().catch((e) => console.warn("Preview play error:", e));
                    }}
                    className="px-3 py-2 rounded-xl bg-[#0e1a38] hover:bg-[#142654] text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1"
                    title="Audition Voice Preview"
                  >
                    <IconPlay className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                )}
                <button
                  onClick={() => onSelectVoice?.(profile)}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow transition-all flex items-center justify-center gap-1.5"
                >
                  <IconSparkles className="w-3.5 h-3.5 text-black" />
                  <span>Use Voice</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
