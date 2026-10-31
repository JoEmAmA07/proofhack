import React from 'react';
import { Presentation, BrainCircuit, Github, CheckSquare, SearchCode, FileCheck2 } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'PPT / README Ingestion',
      desc: 'Ingests project pitch decks, README markdown files, and hackathon submission descriptions.',
      icon: Presentation,
      color: 'from-teal-500 to-emerald-400',
    },
    {
      num: '02',
      title: 'Extract Claims',
      desc: 'Isolates verifiable claims: claimed backend APIs, database models, smart contracts, or AI features.',
      icon: BrainCircuit,
      color: 'from-emerald-400 to-teal-400',
    },
    {
      num: '03',
      title: 'Analyze GitHub Repo',
      desc: 'Inspects directory structure, dependencies, AST symbols, commits, and actual function implementations.',
      icon: Github,
      color: 'from-teal-400 to-cyan-400',
    },
    {
      num: '04',
      title: 'Generate Checks',
      desc: 'Forms precise heuristics and tests to validate whether code is implemented or merely stubbed.',
      icon: CheckSquare,
      color: 'from-cyan-400 to-sky-400',
    },
    {
      num: '05',
      title: 'Collect Evidence',
      desc: 'Gathers source code references, dependency validation, test outputs, and runtime traces.',
      icon: SearchCode,
      color: 'from-sky-400 to-blue-400',
    },
    {
      num: '06',
      title: 'Project Reality Report',
      desc: 'Synthesizes an unforgeable, transparent Reality Score with verified claims vs unverified buzzwords.',
      icon: FileCheck2,
      color: 'from-blue-400 to-indigo-400',
    },
  ];

  return (
    <section id="workflow-section" className="py-20 border-t border-slate-800/80 bg-slate-950/40 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-xs font-mono font-bold tracking-widest text-teal-400 uppercase mb-3">
            Core Verification Architecture
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            How ProofStack Bridges Claims to Code
          </h3>
          <p className="text-slate-400 text-sm sm:text-base">
            Hackathons and software reviews suffer from &ldquo;slide-ware&rdquo; where ideas outpace real code.
            ProofStack provides automated, reproducible verification.
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative group p-6 rounded-2xl bg-brand-surface/70 border border-brand-border/70 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:border-cyan-500/40 transition-colors">
                    <Icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <span className="font-mono text-2xl font-black text-slate-700 group-hover:text-cyan-500/40 transition-colors">
                    {step.num}
                  </span>
                </div>

                <h4 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  {step.title}
                </h4>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Flow banner summary */}
        <div className="mt-12 p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-cyan-300 text-center">
          <span>PPT/README</span>
          <span className="text-slate-600">&rarr;</span>
          <span>Extract Claims</span>
          <span className="text-slate-600">&rarr;</span>
          <span>Analyze GitHub Repo</span>
          <span className="text-slate-600">&rarr;</span>
          <span>Generate Checks</span>
          <span className="text-slate-600">&rarr;</span>
          <span>Collect Evidence</span>
          <span className="text-slate-600">&rarr;</span>
          <span className="text-teal-300 font-bold">Reality Report</span>
        </div>

      </div>
    </section>
  );
};

