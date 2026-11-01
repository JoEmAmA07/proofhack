import React, { useState } from 'react';
import { Check, ChevronDown, FileText, Presentation, ListChecks } from 'lucide-react';
import type { Claim } from '../api/claims';

interface ClaimCardProps {
  claim: Claim;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

const categoryStyle = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('auth') || cat.includes('security')) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
  if (cat.includes('data') || cat.includes('storage') || cat.includes('db')) return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  if (cat.includes('api') || cat.includes('network') || cat.includes('route')) return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
  if (cat.includes('ai') || cat.includes('ml') || cat.includes('llm')) return 'text-violet-300 bg-violet-500/10 border-violet-500/20';
  if (cat.includes('ui') || cat.includes('frontend')) return 'text-pink-300 bg-pink-500/10 border-pink-500/20';
  return 'text-teal-300 bg-teal-500/10 border-teal-500/20';
};

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim, isSelected, onToggleSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const isSlideSource = claim.source.toLowerCase().includes('slide');
  const hasDetails = Boolean(claim.originalText || claim.proposedChecks?.length);

  return (
    <article className={`overflow-hidden rounded-2xl border transition-colors ${isSelected
        ? 'border-teal-500/40 bg-[#142235]'
        : 'border-slate-800 bg-[#101a2b] hover:border-slate-600'
      }`}>
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => onToggleSelect(claim.id)}
          aria-label={`${isSelected ? 'Deselect' : 'Select'} ${claim.title}`}
          aria-pressed={isSelected}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${isSelected ? 'border-teal-400 bg-teal-400 text-slate-950' : 'border-slate-600 bg-slate-900 text-transparent hover:border-teal-400'
            }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${categoryStyle(claim.category)}`}>
              {claim.category}
            </span>
            <span className="inline-flex max-w-full items-center gap-1 text-[10px] text-slate-400">
              {isSlideSource ? <Presentation className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
              <span className="truncate">{claim.source}</span>
            </span>
            <span className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
              {claim.status.replace(/_/g, ' ')}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold leading-snug text-white sm:text-base">{claim.title}</h3>
          {!expanded && claim.originalText && (
            <p className="mt-1.5 truncate text-xs text-slate-400">{claim.originalText}</p>
          )}
        </div>

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} details for ${claim.title}`}
            aria-expanded={expanded}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-400 hover:border-teal-500/40 hover:text-teal-300"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="space-y-4 border-t border-slate-700/60 bg-slate-950/30 px-5 py-4">
          {claim.originalText && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Claim description</p>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">{claim.originalText}</p>
            </div>
          )}
          {claim.proposedChecks && claim.proposedChecks.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <ListChecks className="h-3.5 w-3.5 text-teal-400" /> Proposed verification checks
              </p>
              <ul className="space-y-1.5">
                {claim.proposedChecks.map((check, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-slate-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-400" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
