"use client";

import React, { useEffect, useState } from "react";
import { solarch, User } from "../lib/solarch";
import LandingHero from "../components/ui/LandingHero";
import Dashboard from "../components/ui/Dashboard";
import AuthModal from "../components/ui/AuthModal";
import { VoiceAILogo, IconSparkles } from "../components/ui/Icons";

export default function Home() {
  const [inLab, setInLab] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (solarch.isAuthenticated) {
      setCurrentUser(solarch.getUser());
    }
  }, []);

  const handleEnterLab = () => {
    if (solarch.isAuthenticated) {
      setInLab(true);
    } else {
      setAuthOpen(true);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setInLab(true);
  };

  const handleLogout = () => {
    solarch.logout();
    setCurrentUser(null);
    setInLab(false);
  };

  return (
    <main className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {!inLab && (
        <nav className="w-full border-b border-[#1e293b] bg-[#050814]/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <VoiceAILogo className="w-8 h-8 flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-sm text-white">VOICE AI STUDIO</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  PRO
                </span>
              </div>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">SOLARCH-FIRST PLATFORM</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleEnterLab}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-90 text-black font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
            >
              <IconSparkles className="w-3.5 h-3.5 text-black" />
              LAUNCH STUDIO
            </button>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <div className="flex-1 w-full">
        {inLab ? (
          <Dashboard user={currentUser} onLogout={handleLogout} />
        ) : (
          <LandingHero
            onEnterLab={handleEnterLab}
            onOpenAuth={() => setAuthOpen(true)}
            isAuthenticated={!!currentUser}
          />
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Footer */}
      {!inLab && (
        <footer className="w-full border-t border-[#1e293b] py-4 px-6 text-center text-xs font-mono text-slate-500">
          AUTONOMOUS VOICE AI STUDIO • BUILT ON SOLARCH BaaS v0.20.3 • SPECIALIZED PYTHON ML
        </footer>
      )}
    </main>
  );
}
