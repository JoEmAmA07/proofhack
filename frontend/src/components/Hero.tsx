import React from 'react';
import { ArrowRight, Sparkles, FileText, GitBranch, ShieldAlert } from 'lucide-react';

interface HeroProps {
  onStartVerification: () => void;
  onExploreWorkflow: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onStartVerification, onExploreWorkflow }) => {
  return (
    <div className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
      {/* Background radial glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-cyan-600/15 via-teal-500/10 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Hackathon Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-medium mb-8 backdrop-blur-sm shadow-glow-cyan/20">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Hackathon Foundation &bull; Project Reality Engine</span>
        </div>

        {/* Brand Name & Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6">
          Proof<span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-300 bg-clip-text text-transparent">Stack</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-200 mb-6 font-mono tracking-tight">
          &ldquo;Don&apos;t trust the claim. <span className="text-cyan-400 underline decoration-teal-500/40 decoration-2 underline-offset-4">Verify the build.</span>&rdquo;
        </p>

        {/* Platform Explanation */}
        <p className="max-w-3xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed mb-10">
          ProofStack is an AI-powered verification platform designed to inspect hackathon submissions and software projects. 
          It extracts claims from pitch decks, presentations, and README files, compares them against the actual GitHub codebase, 
          and generates an evidence-backed <strong className="text-slate-200">Project Reality Report</strong>.
        </p>

        {/* Call to action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={onStartVerification}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-cyan-400 text-slate-950 font-bold text-base shadow-glow-cyan hover:shadow-cyan-500/50 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span>Start Verification</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
          
          <button
            onClick={onExploreWorkflow}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white font-medium text-base transition-all cursor-pointer"
          >
            <span>See Core Workflow</span>
          </button>
        </div>

        {/* Quick feature highlights cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left pt-6 border-t border-slate-800/80">
          
          <div className="p-5 rounded-2xl bg-brand-surface/60 border border-brand-border/60 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-teal-950/60 border border-teal-500/30 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5 text-teal-400" />
            </div>
            <h2 className="text-base font-semibold text-white mb-1">Claim Extraction</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Parses READMEs and slide decks to categorize claimed features, supported architectures, and API endpoints.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-brand-surface/60 border border-brand-border/60 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-3">
              <GitBranch className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-base font-semibold text-white mb-1">Repo Reality Check</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analyzes commit history, AST structures, dependencies, and test coverage to separate mockups from real code.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-brand-surface/60 border border-brand-border/60 backdrop-blur-sm hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-sky-950/60 border border-sky-500/30 flex items-center justify-center mb-3">
              <ShieldAlert className="w-5 h-5 text-sky-400" />
            </div>
            <h2 className="text-base font-semibold text-white mb-1">Evidence-Backed Score</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Delivers transparent project reality reports with citation links to exact repository lines and runtime evidence.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

