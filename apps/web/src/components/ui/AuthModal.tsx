"use client";

import React, { useState } from "react";
import { solarch, User } from "../../lib/solarch";
import { VoiceAILogo } from "./Icons";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignup) {
        const { user } = await solarch.signup(email, password, name || "Voice Researcher");
        onSuccess(user);
      } else {
        const { user } = await solarch.login(email, password);
        onSuccess(user);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-[#0b142c] border border-[#1e293b] rounded-2xl p-6 sm:p-7 shadow-2xl text-slate-100 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <VoiceAILogo className="w-8 h-8" />
            <div>
              <h2 className="text-base font-extrabold text-white tracking-wider">
                {isSignup ? "CREATE ACCOUNT" : "SIGN IN"}
              </h2>
              <p className="text-[10px] text-cyan-400 font-mono">SOLARCH AUTHENTICATION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#070d1e] border border-[#1e293b] text-slate-400 hover:text-white flex items-center justify-center transition-all"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">FULL NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Voice Researcher"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d1e] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">EMAIL ADDRESS</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="researcher@voiceai.lab"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d1e] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#070d1e] border border-[#1e293b] text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all tracking-wider"
          >
            {loading ? "AUTHENTICATING..." : isSignup ? "CREATE RESEARCHER ACCOUNT" : "SIGN IN TO WORKSPACE"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-xs text-slate-400 hover:text-cyan-400 font-mono transition-all"
          >
            {isSignup ? "Already registered? Sign in here" : "Need an account? Register new researcher"}
          </button>
        </div>
      </div>
    </div>
  );
}
