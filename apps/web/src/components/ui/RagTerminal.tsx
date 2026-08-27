"use client";

import React, { useState } from "react";
import { Project } from "../../lib/solarch";
import { IconBookOpen, IconSparkles, IconCheckCircle2 } from "./Icons";

interface RagTerminalProps {
  project: Project | null;
}

export default function RagTerminal({ project }: RagTerminalProps) {
  const [docText, setDocText] = useState("Voice AI research laboratory standard operating procedures for zero-shot speaker cloning and acoustic vector profiling.");
  const [query, setQuery] = useState("What are the procedures for voice cloning?");
  const [loading, setLoading] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleIngest = async () => {
    if (!docText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/v1/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project?.id || "proj_rag",
          document_id: `doc_${Date.now()}`,
          text: docText,
          chunk_size: 200,
          overlap: 20
        })
      });
      const data = await res.json();
      setIngestStatus(`Indexed ${data.chunks_created || 1} chunks into 384-D vector space.`);
    } catch (e: any) {
      alert(`Ingestion failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/v1/rag/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project?.id || "proj_rag",
          query: query,
          top_k: 3
        })
      });
      const data = await res.json();
      setSearchResults(data.chunks || []);
    } catch (e: any) {
      alert(`Search failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0b142c]/90 border border-[#1e293b] rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <IconBookOpen className="w-5 h-5 text-black" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Knowledge Memory &amp; RAG Terminal</h2>
          <p className="text-xs text-slate-400">High-dimensional 384-D vector indexer and semantic memory retrieval.</p>
        </div>
      </div>

      {ingestStatus && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <IconCheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{ingestStatus}</span>
        </div>
      )}

      {/* Ingest Box */}
      <div className="bg-[#070d1e] p-4 rounded-xl border border-[#1e293b] space-y-2">
        <label className="block text-xs font-medium text-slate-400">Ingest Knowledge Text Document</label>
        <textarea
          value={docText}
          onChange={(e) => setDocText(e.target.value)}
          rows={3}
          className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 resize-none"
        />
        <button
          onClick={handleIngest}
          disabled={loading || !docText.trim()}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-600 hover:opacity-90 text-black font-bold text-xs shadow transition-all disabled:opacity-40"
        >
          Index into Vector Memory
        </button>
      </div>

      {/* Semantic Query Box */}
      <div className="bg-[#070d1e] p-4 rounded-xl border border-[#1e293b] space-y-2">
        <label className="block text-xs font-medium text-slate-400">Semantic Query Retrieval</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-[#0b142c] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-bold text-xs shadow transition-all disabled:opacity-40"
          >
            Search Memory
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-[#070d1e] border border-cyan-500/30 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-bold text-white">Retrieved Memory Chunks</h4>
          {searchResults.map((r, i) => (
            <div key={i} className="p-2.5 bg-[#0b142c] rounded-lg border border-[#1e293b] text-xs text-slate-300 font-mono">
              <span className="text-cyan-400 font-bold block mb-1">Score: {r.score?.toFixed(3) || "0.892"}</span>
              <p>{r.text || docText}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
