"use client";

import React, { useState } from "react";
import { Project } from "../../lib/solarch";
import { IconTv, IconSparkles, IconCheckCircle2 } from "./Icons";

interface MediaSourceLabProps {
  project: Project | null;
}

export default function MediaSourceLab({ project }: MediaSourceLabProps) {
  const [url, setUrl] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [title, setTitle] = useState("Autonomous Voice AI Review");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const handleIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus("Ingesting & Demuxing media stream...");
    try {
      const res = await fetch("http://localhost:8000/v1/source/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "youtube",
          url: url,
          title: title
        })
      });
      const data = await res.json();
      setResult(data);
      setStatus("Media stream extracted successfully (24kHz Mono WAV).");
    } catch (e: any) {
      alert(`Ingestion failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0b142c]/90 border border-[#1e293b] rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
          <IconTv className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Media &amp; YouTube Stream Lab</h2>
          <p className="text-xs text-slate-400">Stream demuxing, video audio stripping, and 24kHz normalization.</p>
        </div>
      </div>

      {status && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <IconCheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{status}</span>
        </div>
      )}

      {/* Input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#070d1e] p-4 rounded-xl border border-[#1e293b]">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">YouTube / Media URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Media Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      <button
        onClick={handleIngest}
        disabled={loading}
        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 hover:opacity-90 text-white font-extrabold text-xs shadow-lg shadow-red-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
      >
        <IconSparkles className="w-4 h-4 text-white" />
        <span>{loading ? "Extracting Stream..." : "Ingest & Normalize Stream"}</span>
      </button>

      {/* Results */}
      {result && (
        <div className="bg-[#070d1e] border border-cyan-500/30 rounded-xl p-4 space-y-2 text-xs font-mono text-slate-300">
          <div className="flex justify-between"><span>Provider:</span><span className="text-cyan-400 font-bold">{result.provider || "youtube"}</span></div>
          <div className="flex justify-between"><span>Title:</span><span className="text-white">{result.title}</span></div>
          <div className="flex justify-between"><span>Duration:</span><span className="text-emerald-400">{result.duration_sec || 120}s</span></div>
        </div>
      )}
    </div>
  );
}
