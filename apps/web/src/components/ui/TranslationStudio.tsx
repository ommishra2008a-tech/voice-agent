"use client";

import React, { useState } from "react";
import { Project } from "../../lib/solarch";
import { IconGlobe, IconSparkles, IconVolume2, IconDownload } from "./Icons";

interface TranslationStudioProps {
  project: Project | null;
  onAudioPlaybackState?: (isPlaying: boolean) => void;
}

export default function TranslationStudio({ project, onAudioPlaybackState }: TranslationStudioProps) {
  const [sourceText, setSourceText] = useState("Artificial intelligence and neural voice cloning are transforming global communication.");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("hi");
  const [glossary, setGlossary] = useState("{\n  \"voice cloning\": \"ध्वनि क्लोनिंग\",\n  \"AI\": \"एआई\"\n}");

  const [translating, setTranslating] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [translationResult, setTranslationResult] = useState<any | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setTranslating(true);
    setAudioUrl(null);

    try {
      let parsedGlossary = {};
      try {
        parsedGlossary = JSON.parse(glossary);
      } catch (e) {}

      const res = await fetch("http://localhost:8000/v1/translation/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_text: sourceText,
          source_lang: sourceLang === "auto" ? "en" : sourceLang,
          target_lang: targetLang,
          glossary: parsedGlossary
        })
      });
      const data = await res.json();
      setTranslationResult(data);
    } catch (e: any) {
      alert(`Translation Error: ${e.message}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleSynthesizeTranslated = async () => {
    if (!translationResult?.translated_text || !project) return;
    setSynthesizing(true);
    try {
      const res = await fetch("http://localhost:8000/v1/translation/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: project.userId,
          translated_text: translationResult.translated_text,
          target_language: targetLang,
          voice_profile_id: "default_profile"
        })
      });
      const data = await res.json();
      if (data.audio_path) {
        setAudioUrl(`http://localhost:8000/v1/media/audio/raw?path=${encodeURIComponent(data.audio_path)}`);
      }
    } catch (e: any) {
      alert(`Synthesis Error: ${e.message}`);
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-[#0b142c]/90 border border-[#1e293b] rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1e293b] pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <IconGlobe className="w-5 h-5 text-black" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">Neural Translation Studio</h2>
          <p className="text-xs text-slate-400">NLLB-200 multilingual translation with domain glossary preservation.</p>
        </div>
      </div>

      {/* Translation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source Box */}
        <div className="bg-[#070d1e] p-4 rounded-xl border border-[#1e293b] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Source Text</span>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="bg-[#0b142c] border border-[#1e293b] text-white rounded px-2 py-0.5"
            >
              <option value="auto">Auto-Detect</option>
              <option value="en">English (EN)</option>
              <option value="hi">Hindi (HI)</option>
              <option value="es">Spanish (ES)</option>
              <option value="fr">French (FR)</option>
              <option value="de">German (DE)</option>
            </select>
          </div>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={4}
            className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 resize-none"
          />
        </div>

        {/* Target Box */}
        <div className="bg-[#070d1e] p-4 rounded-xl border border-[#1e293b] space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium">Translated Output</span>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-[#0b142c] border border-[#1e293b] text-white rounded px-2 py-0.5"
            >
              <option value="hi">Hindi (HI)</option>
              <option value="en">English (EN)</option>
              <option value="es">Spanish (ES)</option>
              <option value="fr">French (FR)</option>
              <option value="de">German (DE)</option>
              <option value="ja">Japanese (JA)</option>
            </select>
          </div>
          <div className="w-full h-[96px] bg-[#0b142c] border border-[#1e293b] rounded-lg p-2.5 text-xs font-mono text-cyan-300 overflow-y-auto">
            {translationResult?.translated_text || "Translated text will appear here..."}
          </div>
        </div>
      </div>

      {/* Glossary & Actions */}
      <div className="bg-[#070d1e] p-4 rounded-xl border border-[#1e293b] space-y-2">
        <label className="block text-xs font-medium text-slate-400">Custom Terminology Glossary (JSON)</label>
        <textarea
          value={glossary}
          onChange={(e) => setGlossary(e.target.value)}
          rows={2}
          className="w-full bg-[#0b142c] border border-[#1e293b] rounded-lg p-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleTranslate}
          disabled={translating || !sourceText.trim()}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
        >
          {translating ? "Translating..." : "Translate Text"}
        </button>

        {translationResult && (
          <button
            onClick={handleSynthesizeTranslated}
            disabled={synthesizing}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            <IconVolume2 className="w-4 h-4" />
            <span>{synthesizing ? "Synthesizing Speech..." : "Synthesize Translated Speech"}</span>
          </button>
        )}
      </div>

      {/* Audio Output */}
      {audioUrl && (
        <div className="p-4 bg-[#070d1e] border border-cyan-500/30 rounded-xl space-y-2">
          <span className="text-xs text-slate-400">Translated Audio:</span>
          <audio src={audioUrl} controls className="w-full accent-cyan-400" />
        </div>
      )}
    </div>
  );
}
