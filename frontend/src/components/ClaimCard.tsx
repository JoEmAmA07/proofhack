import React from 'react';
import { Check, CheckCircle2, FileText, Presentation } from 'lucide-react';
import { Claim } from '../api/claims';

interface ClaimCardProps {
  claim: Claim;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim, isSelected, onToggleSelect }) => {
  // Category badge colors
  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('auth') || cat.includes('security')) {
      return 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300';
    }
    if (cat.includes('data') || cat.includes('storage') || cat.includes('db')) {
      return 'border-amber-500/30 bg-amber-950/40 text-amber-300';
    }
    if (cat.includes('api') || cat.includes('network') || cat.includes('route')) {
      return 'border-cyan-500/30 bg-cyan-950/40 text-cyan-300';
    }
    if (cat.includes('ai') || cat.includes('ml') || cat.includes('llm')) {
      return 'border-violet-500/30 bg-violet-950/40 text-violet-300';
    }
    if (cat.includes('ui') || cat.includes('frontend')) {
      return 'border-pink-500/30 bg-pink-950/40 text-pink-300';
    }
    if (cat.includes('devops') || cat.includes('infra') || cat.includes('deploy')) {
      return 'border-blue-500/30 bg-blue-950/40 text-blue-300';
    }
    return 'border-teal-500/30 bg-teal-950/40 text-teal-300';
  };

  const isSlideSource = claim.source.toLowerCase().includes('slide');

  return (
    <div
      onClick={() => onToggleSelect(claim.id)}
      className={`relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-brand-surface/90 border-cyan-500/60 shadow-glow-cyan/20 ring-1 ring-cyan-500/30'
          : 'bg-brand-surface/50 border-brand-border/60 hover:border-slate-700 hover:bg-brand-surface/70 opacity-80'
      }`}
    >
      {/* Top Metadata Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        
        {/* Selection Checkbox & Category */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
              isSelected
                ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                : 'border-slate-600 bg-slate-900 text-transparent'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>

          <span
            className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(
              claim.category
            )}`}
          >
            {claim.category}
          </span>
        </div>

        {/* Source and Status Badges */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Source Citation */}
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
            {isSlideSource ? (
              <Presentation className="w-3 h-3 text-amber-400" />
            ) : (
              <FileText className="w-3 h-3 text-cyan-400" />
            )}
            <span>{claim.source}</span>
          </span>

          {/* Status Badge */}
          <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded border border-slate-700 bg-slate-800 text-slate-300 tracking-wider">
            {claim.status.replace('_', ' ')}
          </span>
        </div>

      </div>

      {/* Claim Title */}
      <h4 className="text-base font-bold text-white mb-2 leading-snug">
        {claim.title}
      </h4>

      {/* Supporting Text Quote */}
      {claim.originalText && (
        <div className="mb-4 pl-3 border-l-2 border-cyan-500/40 bg-slate-900/50 p-2.5 rounded-r-xl">
          <p className="text-xs text-slate-300 italic leading-relaxed">
            &ldquo;{claim.originalText}&rdquo;
          </p>
        </div>
      )}

      {/* Proposed Verification Checks */}
      {claim.proposedChecks && claim.proposedChecks.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Proposed Verification Checks:
          </span>
          <ul className="space-y-1">
            {claim.proposedChecks.map((chk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <span className="font-mono text-[11px] text-slate-300">{chk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
