import React, { useState } from 'react';
import { Github, FileText, ArrowLeft, Terminal, AlertTriangle, Layers, Play } from 'lucide-react';
import { HealthResponse } from '../api/health';

interface DashboardPlaceholderProps {
  onBackToLanding: () => void;
  backendInfo?: HealthResponse;
}

export const DashboardPlaceholder: React.FC<DashboardPlaceholderProps> = ({ onBackToLanding, backendInfo }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [claimsText, setClaimsText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <button
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Verification Studio</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full border border-teal-500/40 bg-teal-950/40 text-teal-300">
              Phase 1 Scaffold
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure target project repository and documentation inputs for verification analysis.
          </p>
        </div>

        {/* Backend Connectivity Status Card */}
        <div className="p-3 rounded-xl border border-slate-800 bg-brand-surface/70 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-400"></span>
            <span>API Server:</span>
            <span className="text-teal-400 font-bold">
              {backendInfo ? 'Connected' : 'Active (Polling)'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Uptime: {backendInfo?.uptimeSeconds ?? 0}s &bull; Env: {backendInfo?.environment ?? 'development'}
          </div>
        </div>
      </div>

      {/* Main Form & Verification Setup Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        
        {/* Left 2 Cols: Setup Inputs */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSimulateSubmit} className="p-6 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-6">
            
            {/* Step 1: Repo URL */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Github className="w-4 h-4 text-cyan-400" />
                1. GitHub Repository URL
              </label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/organization/project-name"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors font-mono"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Target repository to scan for commits, code modules, dependencies, and implementations.
              </p>
            </div>

            {/* Step 2: Pitch Deck / README text input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-400" />
                2. Project Claims / README Content (Optional for Phase 1)
              </label>
              <textarea
                value={claimsText}
                onChange={(e) => setClaimsText(e.target.value)}
                rows={5}
                placeholder="Paste claimed features from project slides or markdown: e.g., 'Fully decentralized IPFS storage with end-to-end encryption and automated unit testing.'"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                Claims will be parsed in Phase 2 via Gemini AI to extract verifiable hypotheses.
              </p>
            </div>

            {/* Submit / Trigger Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-sm shadow-glow-cyan hover:brightness-110 active:scale-98 transition-all"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Queue Verification Run</span>
              </button>
            </div>
          </form>

          {/* Submission Notice / Status */}
          {submitted && (
            <div className="p-5 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-200 text-sm space-y-2">
              <div className="flex items-center gap-2 font-semibold text-cyan-300">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Target Registered: <span className="font-mono">{repoUrl}</span>
              </div>
              <p className="text-xs text-slate-300">
                Phase 1 scaffold confirmed! Target repository is captured in UI state. 
                In Phase 2, this action will call backend workers to query the GitHub REST API and trigger Gemini claim extraction.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-xs font-mono text-cyan-400 underline hover:text-cyan-300"
              >
                Clear input
              </button>
            </div>
          )}

        </div>

        {/* Right 1 Col: Phase Roadmap & Architecture Status */}
        <div className="space-y-6">
          
          <div className="p-5 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Implementation Status
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-teal-950/40 border border-teal-500/30 text-teal-300">
                <span className="font-medium">Phase 1: Full-Stack Foundation</span>
                <span className="font-mono text-[10px] uppercase font-bold bg-teal-500/20 px-2 py-0.5 rounded">
                  Completed
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <span>Phase 2: Gemini Claim Extraction</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">Upcoming</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <span>Phase 3: GitHub Repo Deep AST Scan</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">Upcoming</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <span>Phase 4: Playwright Runtime Testing</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">Upcoming</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <span>Phase 5: Reality Report Generation</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">Upcoming</span>
              </div>
            </div>
          </div>

          {/* Honest Verification Notice */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200/90 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-semibold block mb-0.5">Hackathon Integrity Notice</strong>
              No mock results are fabricated. Real verification results will be produced dynamically once GitHub and Gemini APIs are wired in Phase 2.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

