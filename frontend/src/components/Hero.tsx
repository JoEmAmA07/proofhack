
import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  GitBranch,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  Terminal,
  ScanSearch,
} from 'lucide-react';

interface HeroProps {
  onStartVerification: () => void;
  onExploreWorkflow: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onStartVerification,
  onExploreWorkflow,
}) => {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-[-12%] h-[650px] w-[650px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute left-[-15%] top-32 h-[480px] w-[480px] rounded-full bg-sky-500/10 blur-[110px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080d18]/10 to-[#080d18]" />
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 lg:pb-28 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">

          {/* LEFT: Hero content */}
          <div className="relative z-10">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/5 px-4 py-2 text-xs font-semibold tracking-wide text-teal-300">
              <Sparkles className="h-3.5 w-3.5" />
              THE PROJECT REALITY ENGINE
              <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
            </div>

            <h1 className="max-w-3xl text-[clamp(3rem,5.3vw,5.6rem)] font-extrabold leading-[1.04] tracking-[-0.055em] text-white">
              Your code
              <br />
              tells the
              <br />
              <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
                real story.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-400">
              Pitch decks make promises. ProofStack looks for the evidence.
              Compare technical claims with real GitHub repositories and
              create transparent, traceable verification reports.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onStartVerification}
                className="group inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_10px_35px_rgba(20,184,166,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_45px_rgba(20,184,166,0.32)]"
              >
                Launch Verification Studio
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                type="button"
                onClick={onExploreWorkflow}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-7 py-4 text-sm font-semibold text-slate-200 transition-all hover:border-teal-500/40 hover:bg-slate-800"
              >
                Explore the workflow
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                GitHub evidence links
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Manual claim review
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                PDF Reality Reports
              </span>
            </div>
          </div>

          {/* RIGHT: Illustrative product preview */}
          <div className="relative mx-auto w-full max-w-[570px] lg:max-w-none">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-tr from-teal-500/15 via-sky-500/10 to-transparent blur-3xl" />

            <div className="relative overflow-hidden rounded-[24px] border border-slate-700/60 bg-[#0d1625] shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
              {/* Window header */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-[#111c2d] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <div className="ml-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-teal-400" />
                    Verification Workspace
                  </div>
                </div>
                <span className="rounded-md border border-slate-700 px-2 py-1 font-mono text-[10px] text-slate-500">
                  DEMO PREVIEW
                </span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {/* Repository */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/70 bg-[#111e30] p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-slate-800 p-2.5">
                      <GitBranch className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500">
                        Connected repository
                      </p>
                      <p className="truncate font-mono text-xs font-semibold text-slate-200 sm:text-sm">
                        team / project-repository
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-teal-500/25 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-300">
                    Sample
                  </span>
                </div>

                {/* Progress */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">
                      Evidence assessment
                    </p>
                    <span className="text-xs text-slate-500">
                      Illustrative workflow
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Claims', icon: FileText },
                      { label: 'Code', icon: ScanSearch },
                      { label: 'Report', icon: ShieldCheck },
                    ].map(({ label, icon: Icon }, index) => (
                      <div
                        key={label}
                        className="rounded-xl border border-teal-500/20 bg-teal-500/[0.06] px-2 py-3 text-center"
                      >
                        <Icon className="mx-auto mb-2 h-4 w-4 text-teal-300" />
                        <p className="text-[11px] font-semibold text-slate-200">
                          {label}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-teal-400/70">
                          0{index + 1}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example claim cards */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Example claim assessments
                    </p>
                    <Activity className="h-4 w-4 text-slate-500" />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
                      <span className="truncate text-xs font-medium text-slate-200">
                        API endpoint implementation
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold text-teal-300">
                      Code evidence
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Terminal className="h-4 w-4 shrink-0 text-cyan-300" />
                      <span className="truncate text-xs font-medium text-slate-200">
                        End-to-end runtime validation
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                      Not tested
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-xs font-medium text-slate-200">
                        Unverified feature claim
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300">
                      Inconclusive
                    </span>
                  </div>
                </div>

                {/* Report footer */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-500/20 bg-gradient-to-r from-teal-500/10 to-sky-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-teal-500/15 p-2">
                      <ShieldCheck className="h-5 w-5 text-teal-300" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Reality Report
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Evidence, limitations, references
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-teal-300" />
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Feature strip */}
        <div className="mt-24 grid gap-4 border-t border-slate-800/80 pt-8 md:grid-cols-3">
          {[
            {
              number: '01',
              title: 'Extract technical claims',
              description:
                'Turn presentations and project documents into reviewable technical claims.',
              icon: FileText,
            },
            {
              number: '02',
              title: 'Inspect real source code',
              description:
                'Find candidate implementation evidence and trace it back to GitHub.',
              icon: GitBranch,
            },
            {
              number: '03',
              title: 'Generate a Reality Report',
              description:
                'Export an evidence-led PDF with assessments and important limitations.',
              icon: ShieldCheck,
            },
          ].map(({ number, title, description, icon: Icon }) => (
            <div
              key={number}
              className="group rounded-2xl border border-slate-800/80 bg-[#101a2b]/80 p-6 transition-all hover:-translate-y-1 hover:border-teal-500/30 hover:bg-[#142238]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-3">
                  <Icon className="h-5 w-5 text-teal-300" />
                </div>
                <span className="font-mono text-xs text-slate-600">
                  {number} / 03
                </span>
              </div>
              <h3 className="mb-2 text-base font-bold text-white">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
