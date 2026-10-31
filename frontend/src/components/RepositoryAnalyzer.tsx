
import React, { useState } from 'react';
import {
    Github,
    Search,
    Loader2,
    ExternalLink,
    CheckCircle2,
    AlertTriangle,
    FileCode2,
} from 'lucide-react';

import type { Claim } from '../api/claims';

import {
    analyzeRepository,
    matchRepositoryClaims,
    type RepositoryAnalysis,
    type MatchClaimsResult,
    type EvidenceStatus,
} from '../api/repository';

interface Props {
    repoUrl: string;
    selectedClaims: Claim[];
}

const statusLabels: Record<EvidenceStatus, string> = {
    EVIDENCE_FOUND: 'Code Evidence Found',
    LIMITED_EVIDENCE: 'Limited Evidence',
    NO_EVIDENCE_FOUND: 'No Evidence Found',
    INCONCLUSIVE: 'Inconclusive',
};

const statusColors: Record<EvidenceStatus, string> = {
    EVIDENCE_FOUND: 'text-teal-300 border-teal-500/40 bg-teal-950/40',
    LIMITED_EVIDENCE: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
    NO_EVIDENCE_FOUND: 'text-rose-300 border-rose-500/40 bg-rose-950/40',
    INCONCLUSIVE: 'text-slate-300 border-slate-600 bg-slate-800',
};

export const RepositoryAnalyzer: React.FC<Props> = ({
    repoUrl,
    selectedClaims,
}) => {
    const [analysis, setAnalysis] =
        useState<RepositoryAnalysis | null>(null);

    const [matches, setMatches] =
        useState<MatchClaimsResult | null>(null);

    const [analyzedUrl, setAnalyzedUrl] = useState('');
    const [busy, setBusy] = useState<'scan' | 'match' | null>(null);
    const [error, setError] = useState('');

    const currentAnalysis =
        repoUrl.trim() === analyzedUrl ? analysis : null;

    const currentMatches =
        currentAnalysis ? matches : null;

    const handleAnalyze = async () => {
        if (!repoUrl.trim()) {
            setError('Please enter a GitHub repository URL.');
            return;
        }

        setBusy('scan');
        setError('');
        setMatches(null);
        setAnalysis(null);
        setAnalyzedUrl('');

        try {
            const result = await analyzeRepository(repoUrl.trim());
            setAnalysis(result);
            setAnalyzedUrl(repoUrl.trim());
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Repository scan failed.'
            );
        } finally {
            setBusy(null);
        }
    };

    const handleMatch = async () => {
        if (!currentAnalysis) {
            setError('Analyze the repository first.');
            return;
        }

        if (selectedClaims.length === 0) {
            setError('Select at least one extracted claim.');
            return;
        }

        setBusy('match');
        setError('');
        setMatches(null);

        try {
            const result = await matchRepositoryClaims(
                repoUrl.trim(),
                selectedClaims
            );
            setMatches(result);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Claim matching failed.'
            );
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className="space-y-5">
            <div className="p-5 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Github className="w-5 h-5 text-cyan-400" />
                    GitHub Code Verification
                </h2>

                <p className="text-xs text-slate-400">
                    Scan a public repository, then compare selected document
                    claims with available source-code evidence.
                </p>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleAnalyze}
                        disabled={busy !== null || !repoUrl.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-sm font-bold cursor-pointer"
                    >
                        {busy === 'scan'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Search className="w-4 h-4" />}
                        Analyze Repository
                    </button>

                    <button
                        onClick={handleMatch}
                        disabled={
                            busy !== null ||
                            !currentAnalysis ||
                            selectedClaims.length === 0
                        }
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-900 border border-teal-500/50 hover:bg-teal-800 disabled:opacity-40 text-teal-100 text-sm font-semibold cursor-pointer"
                    >
                        {busy === 'match'
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                        Verify Selected Claims ({selectedClaims.length})
                    </button>
                </div>

                {error && (
                    <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs">
                        {error}
                    </div>
                )}

                {currentAnalysis && (
                    <div className="space-y-4 pt-3 border-t border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-white font-bold">
                                    {currentAnalysis.metadata.fullName}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    {currentAnalysis.metadata.description || 'No description'}
                                </p>
                            </div>
                            <a
                                href={currentAnalysis.metadata.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300"
                                aria-label="Open repository on GitHub"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                ['Total Files', currentAnalysis.totalFilesCount],
                                ['Source Scanned', currentAnalysis.scannedFilesCount],
                                ['Dependencies', currentAnalysis.dependencies.length],
                                ['Language', currentAnalysis.metadata.primaryLanguage || 'N/A'],
                            ].map(([label, value]) => (
                                <div key={label} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                                    <p className="text-[11px] text-slate-400">{label}</p>
                                    <p className="text-lg font-bold text-white mt-1">{value}</p>
                                </div>
                            ))}
                        </div>

                        {currentAnalysis.isPartialScan && (
                            <p className="flex items-start gap-2 text-xs text-amber-300">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {currentAnalysis.partialScanReason ||
                                    'Partial scan: not every repository file was analyzed.'}
                            </p>
                        )}

                        <details className="text-xs text-slate-300">
                            <summary className="cursor-pointer text-cyan-300 font-semibold">
                                View scanned files ({currentAnalysis.keyFilesAnalyzed.length})
                            </summary>
                            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                                {currentAnalysis.keyFilesAnalyzed.map((path) => (
                                    <p key={path} className="font-mono break-all">{path}</p>
                                ))}
                            </div>
                        </details>
                    </div>
                )}
            </div>

            {currentMatches && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white">
                        Code Evidence Assessment
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            ['Evidence Found', currentMatches.summary.evidenceFound],
                            ['Limited', currentMatches.summary.limitedEvidence],
                            ['No Evidence', currentMatches.summary.noEvidenceFound],
                            ['Inconclusive', currentMatches.summary.inconclusive],
                        ].map(([label, value]) => (
                            <div key={label} className="p-3 rounded-xl border border-slate-800 bg-slate-900">
                                <p className="text-xs text-slate-400">{label}</p>
                                <p className="text-xl font-bold text-white mt-1">{value}</p>
                            </div>
                        ))}
                    </div>

                    {currentMatches.matches.map((match) => (
                        <article
                            key={match.claimId}
                            className="p-5 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-3"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <h4 className="font-semibold text-white">
                                    {match.claimTitle || match.claimId}
                                </h4>

                                <span className={`px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusColors[match.codeEvidenceStatus]
                                    }`}>
                                    {statusLabels[match.codeEvidenceStatus]}
                                </span>
                            </div>

                            <p className="text-xs text-slate-300">
                                {match.assessmentReason}
                            </p>

                            <p className="text-xs text-slate-400">
                                Runtime: <span className="text-amber-300">
                                    {match.runtimeStatus}
                                </span>
                                {' '}· Heuristic evidence score: {match.confidenceScore}/100
                            </p>

                            <p className="text-[11px] text-slate-500">
                                Code matches are indicators, not proof that a feature works.
                                The score is heuristic, not a verified probability.
                            </p>

                            {match.evidenceSnippets.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-cyan-300 flex items-center gap-2">
                                        <FileCode2 className="w-4 h-4" />
                                        Supporting Code Snippets
                                    </p>

                                    {match.evidenceSnippets.map((snippet, index) => (
                                        <div
                                            key={`${snippet.filePath}-${snippet.lineStart}-${index}`}
                                            className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden"
                                        >
                                            <div className="p-3 flex flex-wrap justify-between gap-2">
                                                <span className="font-mono text-xs text-slate-300 break-all">
                                                    {snippet.filePath}:{snippet.lineStart}
                                                </span>
                                                <a
                                                    href={snippet.permalink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
                                                >
                                                    View on GitHub
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>

                                            <pre className="p-3 text-xs text-slate-200 overflow-x-auto border-t border-slate-800">
                                                <code>{snippet.code}</code>
                                            </pre>

                                            <p className="px-3 pb-3 text-[11px] text-slate-400">
                                                {snippet.relevanceReason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
};
