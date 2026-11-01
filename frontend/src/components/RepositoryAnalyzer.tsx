
import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Github,
    Search,
    Loader2,
    ExternalLink,
    AlertTriangle,
    FileCode2,
    Download,
    ChevronDown,
    ShieldCheck,
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

    const handleExportReport = () => {
        if (!currentAnalysis || !currentMatches) return;

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();
        const M = 17;
        const CW = W - M * 2;
        const bottom = H - 23;
        type RGB = [number, number, number];
        const C = {
            navy: [12, 24, 42] as RGB,
            navy2: [20, 38, 58] as RGB,
            teal: [10, 139, 130] as RGB,
            aqua: [79, 214, 193] as RGB,
            ink: [30, 47, 66] as RGB,
            muted: [98, 114, 130] as RGB,
            pale: [243, 247, 249] as RGB,
            line: [223, 231, 236] as RGB,
            white: [255, 255, 255] as RGB,
            amber: [175, 107, 26] as RGB,
            red: [168, 67, 70] as RGB,
        };
        const statusNames: Record<EvidenceStatus, string> = {
            EVIDENCE_FOUND: 'CODE EVIDENCE FOUND',
            LIMITED_EVIDENCE: 'LIMITED EVIDENCE',
            NO_EVIDENCE_FOUND: 'NO EVIDENCE FOUND',
            INCONCLUSIVE: 'INCONCLUSIVE',
        };
        const statusTint: Record<EvidenceStatus, RGB> = {
            EVIDENCE_FOUND: C.teal,
            LIMITED_EVIDENCE: C.amber,
            NO_EVIDENCE_FOUND: C.red,
            INCONCLUSIVE: C.muted,
        };
        const safe = (v: unknown) => String(v ?? '')
            .replace(/[\u2190-\u21ff\u2794\u27f6]/g, ' -> ')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u2026/g, '...')
            .replace(/\u2022/g, '-')
            .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g, '?');
        const date = new Date();
        const generated = date.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        const repo = currentAnalysis.metadata;
        const items = currentMatches.matches;
        const summary = currentMatches.summary;
        const total = items.length;
        let y = 23;

        const page = () => {
            pdf.addPage();
            y = 24;
        };
        const ensure = (h: number) => { if (y + h > bottom) page(); };
        const line = (yy: number, color: RGB = C.line) => {
            pdf.setDrawColor(...color);
            pdf.setLineWidth(0.25);
            pdf.line(M, yy, W - M, yy);
        };
        const write = (value: unknown, x: number, yy: number, size = 9, color: RGB = C.ink, bold = false) => {
            pdf.setFont('helvetica', bold ? 'bold' : 'normal');
            pdf.setFontSize(size);
            pdf.setTextColor(...color);
            pdf.text(safe(value), x, yy);
        };
        const para = (value: unknown, options: {
            size?: number; color?: RGB; indent?: number; leading?: number;
            gap?: number; bold?: boolean; maxWidth?: number;
        } = {}) => {
            const size = options.size ?? 9;
            const leading = options.leading ?? 4.7;
            const x = M + (options.indent ?? 0);
            const maxWidth = options.maxWidth ?? CW - (options.indent ?? 0);
            pdf.setFont('helvetica', options.bold ? 'bold' : 'normal');
            pdf.setFontSize(size);
            pdf.setTextColor(...(options.color ?? C.ink));
            const paragraphs = safe(value).split(/\r?\n/);
            for (const p of paragraphs) {
                const wrapped = (pdf.splitTextToSize(p || ' ', maxWidth) as string[]);
                for (const text of wrapped) {
                    ensure(leading);
                    pdf.text(text, x, y);
                    y += leading;
                }
            }
            y += options.gap ?? 2.5;
        };
        const section = (number: string, title: string, subtitle?: string) => {
            ensure(subtitle ? 24 : 17);
            line(y - 6);
            write(number, M, y + 1, 8, C.teal, true);
            write(title, M + 13, y + 1, 13, C.navy, true);
            y += 9;
            if (subtitle) para(subtitle, { size: 8.3, color: C.muted, gap: 3 });
        };
        const label = (name: string) => {
            ensure(9);
            write(name.toUpperCase(), M, y, 7.5, C.muted, true);
            y += 5;
        };
        const url = (title: string, address: string, indent = 0) => {
            if (!/^https:\/\/[^\s]+$/i.test(address)) return;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            const x = M + indent;
            const wrapped = pdf.splitTextToSize(safe(title), CW - indent - 3) as string[];
            for (const text of wrapped) {
                ensure(4.6);
                pdf.setTextColor(...C.teal);
                pdf.textWithLink(text, x, y, { url: address });
                y += 4.6;
            }
            y += 2;
        };
        const infoRow = (name: string, value: unknown) => {
            ensure(9);
            write(name, M, y, 8.5, C.muted);
            const valueText = safe(value);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8.5);
            const rows = pdf.splitTextToSize(valueText, CW - 63) as string[];
            for (const [i, row] of rows.entries()) {
                if (i > 0) ensure(4.5);
                write(row, M + 63, y, 8.5, C.ink, true);
                y += 4.5;
            }
            y += 3;
        };
        const codeBlock = (source: string) => {
            const lines = safe(source).replace(/\t/g, '    ').split(/\r?\n/).slice(0, 14);
            if (!lines.length || !lines.some(v => v.trim())) return;
            const pad = 4;
            const codeWidth = CW - pad * 2;
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(7.2);
            const wrapped: string[] = [];
            for (const row of lines) {
                const pieces = pdf.splitTextToSize(row || ' ', codeWidth) as string[];
                wrapped.push(...pieces.slice(0, 3));
            }
            let i = 0;
            while (i < wrapped.length) {
                if (y + 12 > bottom) page();
                const available = Math.max(1, Math.floor((bottom - y - 8) / 4));
                const chunk = wrapped.slice(i, i + Math.min(available, 18));
                const h = chunk.length * 4 + 8;
                pdf.setFillColor(...C.pale);
                pdf.setDrawColor(...C.line);
                pdf.roundedRect(M, y - 3, CW, h, 2, 2, 'FD');
                pdf.setFont('courier', 'normal');
                pdf.setFontSize(7.2);
                pdf.setTextColor(...C.ink);
                chunk.forEach((row, j) => pdf.text(row, M + pad, y + 3 + j * 4));
                y += h + 4;
                i += chunk.length;
            }
            if (lines.length >= 14) para('Excerpt capped at 14 source lines; open the linked file for full context.', { size: 7.3, color: C.muted });
        };

        // COVER: distinct from the technical findings pages.
        pdf.setFillColor(...C.navy);
        pdf.rect(0, 0, W, H, 'F');
        pdf.setFillColor(...C.teal);
        pdf.rect(0, 0, 5, H, 'F');
        pdf.setFillColor(...C.navy2);
        pdf.roundedRect(M, 25, CW, 16, 3, 3, 'F');
        write('PROOFSTACK  /  REPOSITORY INTELLIGENCE', M + 7, 35, 10, C.aqua, true);
        write('REALITY', M, 84, 36, C.white, true);
        write('REPORT', M, 102, 36, C.white, true);
        pdf.setDrawColor(...C.aqua);
        pdf.setLineWidth(1.3);
        pdf.line(M, 115, M + 35, 115);
        write('A transparent assessment of project claims', M, 130, 11, [212, 229, 237]);
        write('against observable repository evidence.', M, 137, 11, [212, 229, 237]);
        pdf.setFillColor(27, 49, 66);
        pdf.roundedRect(M, 163, CW, 67, 3, 3, 'F');
        write('REPOSITORY UNDER REVIEW', M + 9, 177, 8, C.aqua, true);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        pdf.setTextColor(...C.white);
        const repoLines = pdf.splitTextToSize(safe(repo.fullName), CW - 18) as string[];
        repoLines.slice(0, 3).forEach((row, i) => write(row, M + 9, 189 + i * 7, 15, C.white, true));
        write(`${total} claims assessed`, M + 9, 218, 9, [210, 227, 235]);
        write(`Generated ${generated}`, M, 251, 9, [192, 211, 223]);
        write('STATIC EVIDENCE REVIEW  /  NOT A RUNTIME CERTIFICATION', M, 268, 8, C.aqua, true);

        // PAGE 2: executive overview.
        page();
        section('01', 'Executive overview', 'A concise reading of the evidence identified during this repository scan.');
        para(`ProofStack assessed ${total} selected technical claim${total === 1 ? '' : 's'} against files available in ${repo.fullName}. Results reflect static evidence only; no runtime tests, deployment checks, or security audits were performed.`, { size: 9.3, gap: 5 });

        const cards = [
            { label: 'CLAIMS REVIEWED', count: total, color: C.navy },
            { label: 'CODE EVIDENCE', count: summary.evidenceFound, color: C.teal },
            { label: 'LIMITED EVIDENCE', count: summary.limitedEvidence, color: C.amber },
            { label: 'INCONCLUSIVE', count: summary.inconclusive, color: C.muted },
        ];
        const cardGap = 3;
        const cardW = (CW - cardGap * 3) / 4;
        ensure(35);
        cards.forEach((card, i) => {
            const x = M + i * (cardW + cardGap);
            pdf.setFillColor(...C.pale);
            pdf.roundedRect(x, y, cardW, 29, 2, 2, 'F');
            write(String(card.count), x + 5, y + 14, 20, card.color, true);
            write(card.label, x + 5, y + 23, 6.2, C.muted, true);
        });
        y += 38;
        if (summary.noEvidenceFound > 0) para(`${summary.noEvidenceFound} claim(s) had no evidence found in the scanned material. This is not proof that the claims are false.`, { color: C.red, size: 8.6 });

        label('Assessment distribution');
        const counts = [summary.evidenceFound, summary.limitedEvidence, summary.noEvidenceFound, summary.inconclusive];
        const colors = [C.teal, C.amber, C.red, C.muted];
        const barY = y;
        pdf.setFillColor(...C.pale);
        pdf.roundedRect(M, barY, CW, 7, 2, 2, 'F');
        let offset = 0;
        if (total > 0) counts.forEach((count, i) => {
            const span = CW * count / total;
            if (span > 0) {
                pdf.setFillColor(...colors[i]);
                pdf.rect(M + offset, barY, span, 7, 'F');
                offset += span;
            }
        });
        y += 15;
        para('Teal: code evidence   |   Amber: limited   |   Red: none found   |   Grey: inconclusive', { size: 7.8, color: C.muted, gap: 5 });

        section('02', 'Repository snapshot');
        infoRow('Repository', repo.fullName);
        infoRow('Primary language', repo.primaryLanguage || 'Not reported');
        infoRow('Source files scanned', currentAnalysis.scannedFilesCount);
        infoRow('Repository files reported', currentAnalysis.totalFilesCount);
        infoRow('Dependencies identified', currentAnalysis.dependencies.length);
        infoRow('Scan coverage', currentAnalysis.isPartialScan ? 'PARTIAL' : 'As reported by scanner');
        url('OPEN REPOSITORY ON GITHUB', repo.htmlUrl);
        if (currentAnalysis.isPartialScan) {
            para(`Coverage limitation: ${currentAnalysis.partialScanReason || 'Not all repository files were scanned.'}`, { size: 8.6, color: C.amber });
        }

        section('03', 'How to interpret this report');
        para('A code reference is a candidate implementation indicator, not an execution trace. Package declarations, imports, and matching names may provide context without demonstrating functionality. The report does not independently verify runtime behavior.', { size: 9 });

        // Overview table: a compact, readable index of findings.
        page();
        section('04', 'Claim assessment index', 'Every selected claim and its static-evidence classification.');
        autoTable(pdf, {
            startY: y,
            head: [['#', 'CLAIM', 'STATIC ASSESSMENT', 'REFS']],
            body: items.map((item, i) => [
                String(i + 1).padStart(2, '0'),
                safe(item.claimTitle || item.claimId),
                statusNames[item.codeEvidenceStatus],
                String(item.evidenceSnippets.length),
            ]),
            theme: 'plain',
            margin: { left: M, right: M, top: 24, bottom: 24 },
            headStyles: { fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
            styles: { font: 'helvetica', fontSize: 8, textColor: C.ink, cellPadding: 3.4, overflow: 'linebreak', valign: 'middle', lineColor: C.line, lineWidth: 0.15 },
            alternateRowStyles: { fillColor: C.pale },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 89 },
                2: { cellWidth: 58 },
                3: { cellWidth: 17, halign: 'center' },
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const item = items[data.row.index];
                    if (item) data.cell.styles.textColor = statusTint[item.codeEvidenceStatus];
                }
            },
        });
        y = (((pdf as typeof pdf & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) ?? y) + 12;
        ensure(12);
        para('REFS indicates candidate source references included in the assessment, not independently verified implementations.', { size: 8, color: C.muted });

        // Detailed claim assessments: section headers, rationale, actual code and links.
        page();
        section('05', 'Detailed evidence assessments', 'Each finding includes the original claim, assessment rationale, and cited source references.');
        for (const [i, item] of items.entries()) {
            const title = safe(item.claimTitle || item.claimId);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(12);
            const titleLines = pdf.splitTextToSize(title, CW - 18) as string[];
            const headH = Math.max(23, titleLines.length * 5.5 + 13);
            ensure(headH + 22);
            pdf.setFillColor(...C.navy);
            pdf.roundedRect(M, y - 3, CW, headH, 2, 2, 'F');
            write(String(i + 1).padStart(2, '0'), M + 5, y + 6, 12, C.aqua, true);
            titleLines.forEach((row, j) => write(row, M + 18, y + 6 + j * 5.5, 11, C.white, true));
            y += headH + 4;
            write(statusNames[item.codeEvidenceStatus], M, y, 9, statusTint[item.codeEvidenceStatus], true);
            y += 6;
            para(`Runtime: ${safe(item.runtimeStatus).replace(/_/g, ' ')}. No functional execution was performed.`, { size: 8.1, color: C.muted });
            label('Original claim');
            para(item.originalText || title, { size: 9.2, gap: 4 });
            label('Assessment rationale');
            para(item.assessmentReason, { size: 9.1, gap: 4 });

            if (item.matchedDependencies?.length) {
                label('Related declared dependencies');
                const names = item.matchedDependencies.slice(0, 10).map(d => d.name);
                para(`${names.join(', ')}${item.matchedDependencies.length > 10 ? ', ...' : ''}. Package declarations do not prove runtime use.`, { size: 8.4, color: C.muted });
            }

            if (item.implementationTrail?.steps.length) {
                label('Static call relationships');
                para(item.implementationTrail.description || 'Related calls identified through static analysis; not a verified execution sequence.', { size: 8.3, color: C.muted });
                for (const step of item.implementationTrail.steps.slice(0, 5)) {
                    const call = `${safe(step.caller).slice(0, 80)} -> ${safe(step.callee).slice(0, 80)}`;
                    para(call, { size: 8.5, bold: true, gap: 1 });
                    para(`${step.filePath}:${step.line}`, { size: 7.8, color: C.muted, gap: 1 });
                    url('View call reference on GitHub', step.permalink);
                }
            }

            if (item.evidenceSnippets.length) {
                label(`Candidate source references (${item.evidenceSnippets.length})`);
                for (const [j, snippet] of item.evidenceSnippets.entries()) {
                    ensure(28);
                    write(`REFERENCE ${j + 1}  /  ${safe(snippet.kind).toUpperCase()}`, M, y, 8, C.teal, true);
                    y += 6;
                    para(`${snippet.filePath}:${snippet.lineStart}${snippet.lineEnd > snippet.lineStart ? `-${snippet.lineEnd}` : ''}`, { size: 8.1, bold: true, gap: 2 });
                    para(snippet.relevanceReason, { size: 8.4, color: C.muted, gap: 3 });
                    if (snippet.code?.trim()) codeBlock(snippet.code);
                    url('OPEN EXACT SOURCE REFERENCE ON GITHUB', snippet.permalink);
                    y += 3;
                }
            } else {
                para('No candidate source references were returned for this claim in the analyzed material.', { size: 8.5, color: C.muted });
            }
            y += 5;
        }

        section('06', 'Methodology and limitations');
        para('ProofStack scans the accessible repository snapshot, extracts structural indicators such as functions, classes, routes, imports and declared dependencies, and matches those indicators to the selected claims. Candidate references are ranked and presented for human review. A static call relationship is not a recorded runtime execution path.', { size: 9 });
        para('Evidence classifications are not a guarantee of correctness, security, performance, deployment status, or feature completeness. Limited and inconclusive findings require manual follow-up. Absence of evidence in scanned files does not establish that a claim is false.', { size: 9 });
        if (currentAnalysis.isPartialScan) para(`This was a partial scan: ${currentAnalysis.partialScanReason || 'coverage was restricted'}. Unscanned files may contain additional evidence.`, { size: 8.8, color: C.amber });
        para('This document is intended for transparent project review and technical discussion, not certification.', { size: 8.4, color: C.muted });

        // Uniform page furniture, except the full-bleed cover.
        const pages = pdf.getNumberOfPages();
        for (let n = 2; n <= pages; n++) {
            pdf.setPage(n);
            pdf.setFillColor(...C.navy);
            pdf.rect(0, 0, W, 11, 'F');
            write('PROOFSTACK  /  REALITY REPORT', M, 7.3, 7.5, C.white, true);
            write(safe(repo.fullName).slice(0, 35), M + 95, 7.3, 7.5, C.aqua);
            line(H - 18);
            write('STATIC REPOSITORY EVIDENCE  -  RUNTIME NOT VERIFIED', M, H - 12, 7.1, C.muted);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(7.1);
            pdf.setTextColor(...C.muted);
            pdf.text(`${n} / ${pages}`, W - M, H - 12, { align: 'right' });
        }
        const filename = safe(repo.fullName).replace(/[^a-z0-9_-]/gi, '_').slice(0, 70);
        pdf.save(`ProofStack_Reality_Report_${filename}.pdf`);
    };

    return (
        <section className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-[#101a2b] shadow-xl shadow-black/10">
                <div className="border-b border-slate-800 bg-gradient-to-r from-teal-500/10 via-sky-500/5 to-transparent p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-teal-400/20 bg-teal-400/10 p-3">
                            <Github className="h-5 w-5 text-teal-300" />
                        </div>
                        <div>
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">Repository Intelligence</p>
                            <h2 className="text-xl font-bold text-white">GitHub Code Verification</h2>
                            <p className="mt-1 text-sm leading-relaxed text-slate-400">
                                Scan a public repository, then assess selected claims against available source-code evidence.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-5 p-5 sm:p-6">
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleAnalyze}
                            disabled={busy !== null || !repoUrl.trim()}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy === 'scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            {busy === 'scan' ? 'Scanning repository...' : 'Analyze Repository'}
                        </button>
                        <button
                            type="button"
                            onClick={handleMatch}
                            disabled={busy !== null || !currentAnalysis || selectedClaims.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/10 px-5 py-3 text-sm font-semibold text-teal-200 transition-all hover:bg-teal-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {busy === 'match' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            {busy === 'match' ? 'Checking claims...' : `Verify Selected Claims (${selectedClaims.length})`}
                        </button>
                    </div>

                    {error && (
                        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                            {error}
                        </div>
                    )}

                    {currentAnalysis && (
                        <div className="space-y-4 border-t border-slate-800 pt-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="break-all text-base font-bold text-white">{currentAnalysis.metadata.fullName}</p>
                                    <p className="mt-1 text-xs text-slate-400">{currentAnalysis.metadata.description || 'No repository description'}</p>
                                </div>
                                <a href={currentAnalysis.metadata.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label="Open repository on GitHub" className="shrink-0 rounded-lg border border-slate-700 p-2 text-teal-300 hover:bg-slate-800">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {[
                                    ['Repository Files', currentAnalysis.totalFilesCount],
                                    ['Source Scanned', currentAnalysis.scannedFilesCount],
                                    ['Dependencies', currentAnalysis.dependencies.length],
                                    ['Primary Language', currentAnalysis.metadata.primaryLanguage || 'N/A'],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className="rounded-xl border border-slate-800 bg-[#0b1321] p-3">
                                        <p className="text-[11px] text-slate-400">{label}</p>
                                        <p className="mt-1 break-words text-lg font-bold text-white">{value}</p>
                                    </div>
                                ))}
                            </div>
                            {currentAnalysis.isPartialScan && (
                                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{currentAnalysis.partialScanReason || 'Partial scan: not every repository file was analyzed.'}</span>
                                </div>
                            )}
                            <details className="group rounded-xl border border-slate-800 bg-[#0b1321]">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                                    <span>Scanned source files ({currentAnalysis.keyFilesAnalyzed.length})</span>
                                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="max-h-48 space-y-1 overflow-y-auto border-t border-slate-800 px-4 py-3">
                                    {currentAnalysis.keyFilesAnalyzed.map((path) => (
                                        <p key={path} className="break-all font-mono text-[11px] text-slate-400">{path}</p>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            </div>

            {currentMatches && (
                <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">Assessment Results</p>
                            <h3 className="mt-1 text-xl font-bold text-white">Code Evidence Assessment</h3>
                            <p className="mt-1 text-xs text-slate-400">Static indicators only; runtime functionality is not verified.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportReport}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:brightness-110"
                        >
                            <Download className="h-4 w-4" />
                            Download Reality Report
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                            ['Evidence Found', currentMatches.summary.evidenceFound, 'text-teal-300'],
                            ['Limited Evidence', currentMatches.summary.limitedEvidence, 'text-amber-300'],
                            ['No Evidence', currentMatches.summary.noEvidenceFound, 'text-rose-300'],
                            ['Inconclusive', currentMatches.summary.inconclusive, 'text-slate-300'],
                        ].map(([label, value, color]) => (
                            <div key={String(label)} className="rounded-2xl border border-slate-800 bg-[#101a2b] p-4">
                                <p className="text-xs text-slate-400">{label}</p>
                                <p className={`mt-2 text-3xl font-extrabold ${color}`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3">
                        {currentMatches.matches.map((match, index) => (
                            <article key={`${match.claimId}-${index}`} className="overflow-hidden rounded-2xl border border-slate-700/60 bg-[#101a2b]">
                                <div className="space-y-3 p-4 sm:p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 font-mono text-xs font-semibold text-slate-300">{index + 1}</span>
                                            <h4 className="min-w-0 pt-1 text-sm font-bold leading-relaxed text-white sm:text-base">{match.claimTitle || match.claimId}</h4>
                                        </div>
                                        <span className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${statusColors[match.codeEvidenceStatus]}`}>
                                            {statusLabels[match.codeEvidenceStatus]}
                                        </span>
                                    </div>
                                    <p className="text-xs leading-relaxed text-slate-300">{match.assessmentReason}</p>
                                    <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3 text-[11px] text-slate-400">
                                        <span>Runtime: <span className="font-semibold text-amber-300">{match.runtimeStatus.replace(/_/g, ' ')}</span></span>
                                        <span>Code matches do not establish working behavior.</span>
                                    </div>
                                </div>

                                {(match.implementationTrail?.steps.length || match.evidenceSnippets.length > 0) ? (
                                    <div className="space-y-2 border-t border-slate-800 bg-[#0c1524]/60 p-3 sm:p-4">
                                        {match.implementationTrail && match.implementationTrail.steps.length > 0 && (
                                            <details className="group overflow-hidden rounded-xl border border-slate-800 bg-[#111d30]">
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-cyan-300 [&::-webkit-details-marker]:hidden">
                                                    <span>Implementation Trail ({match.implementationTrail.steps.length} steps)</span>
                                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="space-y-3 border-t border-slate-800 p-4">
                                                    <p className="text-xs leading-relaxed text-slate-400">{match.implementationTrail.description}</p>
                                                    {match.implementationTrail.steps.map((step, stepIndex) => (
                                                        <div key={`${step.filePath}-${step.line}-${stepIndex}`} className="rounded-lg border border-slate-800 bg-[#0b1321] p-3">
                                                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                <span className="break-all rounded bg-cyan-500/10 px-2 py-1 text-cyan-300">{step.caller}</span>
                                                                <span className="text-slate-500">calls</span>
                                                                <span className="break-all rounded bg-teal-500/10 px-2 py-1 text-teal-300">{step.callee}</span>
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                                                <span className="break-all font-mono text-slate-400">{step.filePath}:{step.line}</span>
                                                                <a href={step.permalink} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">View on GitHub ↗</a>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}

                                        {match.evidenceSnippets.length > 0 && (
                                            <details className="group overflow-hidden rounded-xl border border-slate-800 bg-[#111d30]">
                                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-cyan-300 [&::-webkit-details-marker]:hidden">
                                                    <span className="inline-flex items-center gap-2"><FileCode2 className="h-4 w-4" /> Candidate Code Snippets ({match.evidenceSnippets.length})</span>
                                                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                                                </summary>
                                                <div className="space-y-3 border-t border-slate-800 p-3 sm:p-4">
                                                    {match.evidenceSnippets.map((snippet, snippetIndex) => (
                                                        <div key={`${snippet.filePath}-${snippet.lineStart}-${snippetIndex}`} className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1321]">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                                                                <span className="break-all font-mono text-[11px] text-slate-200">{snippet.filePath}:{snippet.lineStart}</span>
                                                                <a href={snippet.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline">View on GitHub <ExternalLink className="h-3 w-3" /></a>
                                                            </div>
                                                            <p className="px-3 pb-3 text-xs leading-relaxed text-slate-400">{snippet.relevanceReason}</p>
                                                            <details className="border-t border-slate-800">
                                                                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-teal-300">Show source code</summary>
                                                                <pre className="max-h-64 overflow-auto border-t border-slate-800 p-3 text-xs leading-relaxed text-slate-200"><code>{snippet.code}</code></pre>
                                                            </details>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ) : null}
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
