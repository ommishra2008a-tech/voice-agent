"use client";

import React, { useState } from "react";
import { Project } from "../../lib/solarch";
import ModelBenchmarkLab from "./ModelBenchmarkLab";
import SolarchLab from "./SolarchLab";
import RagTerminal from "./RagTerminal";
import MediaSourceLab from "./MediaSourceLab";
import DubbingStudio from "./DubbingStudio";
import VoiceEditor from "./VoiceEditor";
import {
  IconZap,
  IconDatabase,
  IconBookOpen,
  IconTv,
  IconFilm,
  IconSliders
} from "./Icons";

interface AdvancedLabProps {
  project: Project | null;
  onAudioPlaybackState?: (isPlaying: boolean, audioEl?: HTMLAudioElement | null) => void;
}

type LabTab = "benchmarks" | "solarch" | "rag" | "media" | "dubbing" | "editor";

export default function AdvancedLab({ project, onAudioPlaybackState }: AdvancedLabProps) {
  const [activeTab, setActiveTab] = useState<LabTab>("benchmarks");

  const tabs: { id: LabTab; label: string; icon: React.ReactNode }[] = [
    { id: "benchmarks", label: "Model Benchmarks", icon: <IconZap className="w-4 h-4 text-purple-400" /> },
    { id: "solarch", label: "Solarch BaaS", icon: <IconDatabase className="w-4 h-4 text-blue-400" /> },
    { id: "rag", label: "Knowledge RAG", icon: <IconBookOpen className="w-4 h-4 text-emerald-400" /> },
    { id: "media", label: "Media & YouTube", icon: <IconTv className="w-4 h-4 text-red-400" /> },
    { id: "dubbing", label: "Dubbing Studio", icon: <IconFilm className="w-4 h-4 text-cyan-400" /> },
    { id: "editor", label: "Fine-Grained Editor", icon: <IconSliders className="w-4 h-4 text-amber-400" /> }
  ];

  return (
    <div className="w-full space-y-4">
      {/* Advanced Lab Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b142c]/90 border border-[#1e293b] p-2 rounded-2xl backdrop-blur-xl shadow-xl">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white hover:bg-[#070d1e]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px] font-mono text-cyan-400 px-3 hidden md:inline">
          Expert Diagnostic Workbench
        </span>
      </div>

      {/* Selected Technical Component */}
      <div className="transition-all">
        {activeTab === "benchmarks" && <ModelBenchmarkLab project={project} />}
        {activeTab === "solarch" && <SolarchLab project={project} />}
        {activeTab === "rag" && <RagTerminal project={project} />}
        {activeTab === "media" && <MediaSourceLab project={project} />}
        {activeTab === "dubbing" && <DubbingStudio project={project} />}
        {activeTab === "editor" && <VoiceEditor project={project} onAudioPlaybackState={onAudioPlaybackState} />}
      </div>
    </div>
  );
}
