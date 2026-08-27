"use client";

import React, { useState, useEffect } from "react";
import { solarch, Project } from "../../lib/solarch";
import { IconDatabase, IconRefreshCw } from "./Icons";

interface SolarchLabProps {
  project: Project | null;
}

export default function SolarchLab({ project }: SolarchLabProps) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const projs = await solarch.getProjects();
      setCollections([
        { name: "projects", count: projs.length, rule: "user_scoped" },
        { name: "voice_profiles", count: 3, rule: "user_scoped" },
        { name: "generation_jobs", count: 8, rule: "user_scoped" },
        { name: "source_assets", count: 2, rule: "user_scoped" },
        { name: "documents", count: 1, rule: "user_scoped" }
      ]);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0b142c]/90 border border-[#1e293b] rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <IconDatabase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">Solarch BaaS Platform Core</h2>
            <p className="text-xs text-slate-400">Schema rules, real-time SSE channels, and collection health.</p>
          </div>
        </div>

        <button
          onClick={loadInfo}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-[#070d1e] hover:bg-[#152347] border border-[#1e293b] text-cyan-300 text-xs font-semibold transition-all flex items-center gap-1.5 shadow"
        >
          <IconRefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Collections</span>
        </button>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {collections.map((col) => (
          <div key={col.name} className="p-4 rounded-xl bg-[#070d1e] border border-[#1e293b] space-y-1">
            <span className="text-xs font-mono font-bold text-cyan-400">{col.name}</span>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Records:</span>
              <span className="text-white font-mono">{col.count}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Access Rule:</span>
              <span className="text-emerald-400 font-mono">{col.rule}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
