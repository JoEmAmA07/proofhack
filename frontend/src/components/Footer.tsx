import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800/80 bg-brand-surface/40 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">ProofStack</span>
              <p className="text-xs text-slate-400">
                &ldquo;Don&apos;t trust the claim. Verify the build.&rdquo;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              React + TypeScript + Vite
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              Tailwind CSS
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              Express + Node.js
            </div>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Hackathon Edition &bull; Phase 1 Foundation
          </p>
        </div>

      </div>
    </footer>
  );
};

