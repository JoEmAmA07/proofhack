import React, { useRef, useState } from 'react';
import {
  Github,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Sparkles,
  Search,
  SlidersHorizontal,
  Key,
  ChevronDown,
  ChevronUp,
  ArrowDown,
} from 'lucide-react';
import { HealthResponse } from '../api/health';
import {
  ExtractionResult,
  DocumentPreview,
  uploadAndExtractClaims,
  uploadAndPreviewDocument,
} from '../api/claims';
import { DocumentUploadZone } from './DocumentUploadZone';
import { ClaimCard } from './ClaimCard';
import { RepositoryAnalyzer } from './RepositoryAnalyzer';

interface DashboardPlaceholderProps {
  onBackToLanding: () => void;
  backendInfo?: HealthResponse;
}

export const DashboardPlaceholder: React.FC<DashboardPlaceholderProps> = ({
  onBackToLanding,
}) => {
  // Target Repo state (Preserved for Phase 3)
  const [repoUrl, setRepoUrl] = useState('');

  // Document Upload & Extraction state (Phase 2)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] =
    useState<DocumentPreview | null>(null);

  const [fallbackNotice, setFallbackNotice] =
    useState<string | null>(null);

  const [manualClaimTitle, setManualClaimTitle] = useState('');
  const [manualClaimText, setManualClaimText] = useState('');
  const [manualClaimSource, setManualClaimSource] = useState('');
  const [manualClaimError, setManualClaimError] = useState('');

  // Selected Claims for future verification
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  const claimIdCounter = useRef(0);
  const claimCollectionRef = useRef<ExtractionResult['claims']>([]);

  // One shared collection for GitHub, uploads, manual entries, and demo claims.
  // Keep existing selections and assign unique IDs across repeated extractions.
  const mergeClaims = (
    incoming: ExtractionResult['claims'],
    sourceName: string,
    documentType: ExtractionResult['documentType'],
    explanation: string,
    selectNew = false,
    pageOrSlideCount?: number,
  ) => {
    const existing = claimCollectionRef.current;
    const seen = new Set(existing.map((claim) => claim.originalText.trim().toLowerCase().replace(/\s+/g, ' ')));
    const additions: ExtractionResult['claims'] = [];
    for (const claim of incoming) {
      const key = claim.originalText.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      additions.push({
        ...claim,
        id: `combined-${++claimIdCounter.current}`,
        source: `${sourceName} / ${claim.source || 'Document'}`,
      });
    }
    const combined = [...existing, ...additions];
    claimCollectionRef.current = combined;
    setExtractionResult((previous) => ({
      documentName: 'Combined Claim Collection',
      documentType: previous?.documentType ?? documentType,
      pageOrSlideCount: previous?.pageOrSlideCount ?? pageOrSlideCount,
      totalClaims: combined.length,
      explanation: 'Combined suggestions from GitHub documentation, uploaded files, and manual entries. Review each claim before verification. ' + explanation,
      claims: combined,
    }));
    if (selectNew && additions.length) {
      setSelectedClaimIds((previous) => new Set([...previous, ...additions.map((claim) => claim.id)]));
    }
  };


  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [claimsExpanded, setClaimsExpanded] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const verificationRef = useRef<HTMLDivElement>(null);

  const jumpToVerification = () => {
    setClaimsExpanded(false);
    requestAnimationFrame(() => {
      verificationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Trigger claim extraction

  const handleExtractClaims = async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);
    setFallbackNotice(null);
    setDocumentPreview(null);
    // Preserve claims and selections from earlier sources.
    setClaimsExpanded(false);
    setPreviewExpanded(false);
    setManualExpanded(false);

    try {
      // First try AI-powered claim extraction.
      const aiResult = await uploadAndExtractClaims(file);


      if (aiResult.success && aiResult.data) {
        mergeClaims(aiResult.data.claims, aiResult.data.documentName || file.name,
          aiResult.data.documentType, aiResult.data.explanation || '', true,
          aiResult.data.pageOrSlideCount);

        // Load the actual document text for preview,
        // even when claim extraction succeeds.
        try {
          const previewResult = await uploadAndPreviewDocument(file);

          if (previewResult.success && previewResult.data) {
            setDocumentPreview(previewResult.data);
          }
        } catch (previewError) {
          console.warn('Document preview unavailable:', previewError);
        }

        return;
      }


      // If Gemini fails, still read the actual uploaded document.
      const previewResult = await uploadAndPreviewDocument(file);


      if (previewResult.success && previewResult.data) {
        const preview = previewResult.data;
        const suggestions = preview.suggestedClaims ?? [];

        setDocumentPreview(preview);

        if (suggestions.length > 0) {
          mergeClaims(suggestions, preview.documentName || file.name,
            preview.documentType,
            'Offline suggestions from uploaded document; not verified.', false,
            preview.pageOrSlideCount);

          setFallbackNotice(
            `${suggestions.length} technical claim suggestions found without Gemini. Review the suggestions below and select the ones you want to check.`
          );
        } else {
          setFallbackNotice(
            'Your document was read successfully, but no technical claim suggestions were found. You can create claims manually below.'
          );
        }

        return;
      }


      setExtractionError(
        previewResult.error ||
        aiResult.error ||
        'Unable to process the uploaded document.'
      );
    } finally {
      setIsExtracting(false);
    }
  };


  const handleDiscoverRepositoryClaims = async () => {
    if (!/^https:\/\/github\.com\/[^/]+\/[^/?#]+\/?(?:[?#].*)?$/i.test(repoUrl.trim())) {
      setDiscoveryError('Enter a public GitHub repository URL first.');
      return;
    }
    setIsDiscovering(true);
    setDiscoveryError(null);
    setExtractionError(null);
    setFallbackNotice(null);
    try {
      const response = await fetch('/api/claims/discover-repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || payload.error || 'Repository documentation discovery failed.');
      }
      const result = payload.data as {
        repository: string;
        documents: Array<{ path: string; claimCount: number }>;
        claims: ExtractionResult['claims'];
        totalClaims: number;
        explanation: string;
      };
      setClaimsExpanded(true);
      setSearchQuery('');
      setSelectedCategory('ALL');
      mergeClaims(result.claims, `GitHub: ${result.repository}`, 'markdown',
        result.explanation, false);
      setFallbackNotice(
        `Read ${result.documents.length} documentation file(s); found ${result.claims.length} unverified suggestion(s). Select only concrete technical claims.`
      );
    } catch (error: unknown) {
      setDiscoveryError(error instanceof Error ? error.message : 'Unable to discover repository documentation.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddManualClaim = () => {
    const title = manualClaimTitle.trim();
    const originalText = manualClaimText.trim();
    const source = manualClaimSource.trim();

    if (!title || !originalText) {
      setManualClaimError('Enter both a claim title and description.');
      return;
    }

    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newClaim = {
      id,
      title,
      originalText,
      category: 'Manual',
      source: source || documentPreview?.documentName || extractionResult?.documentName || 'Manual entry',
      proposedChecks: ['Inspect relevant repository implementation'],
      status: 'NOT_TESTED' as const,
    };

    mergeClaims([newClaim], source || 'Manual entry', 'markdown',
      'Manually entered claims are unverified.', true);

    setManualClaimTitle('');
    setManualClaimText('');
    setManualClaimSource('');
    setManualClaimError('');
    setClaimsExpanded(true);
  };

  // Toggle single claim selection

  // Demo fallback: sample claims for testing GitHub verification.
  // These are NOT extracted from the uploaded document.
  const handleLoadDemoClaims = () => {
    const demoClaims = [
      {
        id: 'demo-1',
        title: 'HTTP API routing',
        originalText: 'The project implements HTTP GET and POST routing.',
        category: 'API',
        source: 'DEMO DATA — not extracted from document',
        proposedChecks: ['Inspect HTTP routes', 'Check router implementation'],
        status: 'NOT_TESTED' as const,
      },
      {
        id: 'demo-2',
        title: 'Middleware support',
        originalText: 'The project supports middleware functions for handling requests.',
        category: 'Backend',
        source: 'DEMO DATA — not extracted from document',
        proposedChecks: ['Inspect middleware functions'],
        status: 'NOT_TESTED' as const,
      },
      {
        id: 'demo-3',
        title: 'HTTP request and response handling',
        originalText: 'The project implements HTTP request and response handling.',
        category: 'Backend',
        source: 'DEMO DATA — not extracted from document',
        proposedChecks: ['Inspect request handlers', 'Inspect response handlers'],
        status: 'NOT_TESTED' as const,
      },
      {
        id: 'demo-4',
        title: 'Express Router support',
        originalText: 'The project uses Express Router to organize routes.',
        category: 'API',
        source: 'DEMO DATA — not extracted from document',
        proposedChecks: ['Inspect router imports', 'Inspect route registration'],
        status: 'NOT_TESTED' as const,
      },
    ];

    mergeClaims(demoClaims, 'DEMO — Express.js Sample Claims', 'markdown',
      'Demo data is predefined and not extracted from the repository.', true);
    setExtractionError(null);
    setSearchQuery('');
    setSelectedCategory('ALL');
    setClaimsExpanded(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedClaimIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all
  const handleSelectAll = (select: boolean) => {
    if (!extractionResult) return;
    if (select) {
      setSelectedClaimIds(new Set(extractionResult.claims.map((c) => c.id)));
    } else {
      setSelectedClaimIds(new Set());
    }
  };

  // Filtered claims
  const claims = extractionResult?.claims || [];
  const claimsForVerification = claims.filter((claim) =>
    selectedClaimIds.has(claim.id)
  );
  const categories = ['ALL', ...Array.from(new Set(claims.map((c) => c.category)))];

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' || claim.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const isMissingApiKey =
    extractionError &&
    (extractionError.toLowerCase().includes('gemini_api_key') ||
      extractionError.toLowerCase().includes('api key'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Studio introduction */}
      <div className="relative overflow-hidden rounded-[28px] border border-teal-500/20 bg-gradient-to-br from-[#152b39] via-[#101c2e] to-[#0c1423] p-6 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button onClick={onBackToLanding} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-teal-300 hover:text-teal-200">
              <ArrowLeft className="h-4 w-4" /> Back to Overview
            </button>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300">
              <ShieldCheck className="h-4 w-4" /> ProofStack Workspace
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Verification <span className="text-gradient">Studio.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
              Upload your project document, review technical claims, and inspect evidence from the actual GitHub repository.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <div className="rounded-xl bg-teal-400/10 p-2.5"><Layers className="h-5 w-5 text-teal-300" /></div>
            <div><p className="text-xs text-slate-400">Claims selected</p><p className="text-2xl font-extrabold text-white">{selectedClaimIds.size}<span className="ml-1 text-sm font-medium text-slate-500">/ {claims.length}</span></p></div>
          </div>
        </div>
      </div>

      {/* Workflow guide: stages are actions, not development phases */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: FileText, label: '01 / DOCUMENT', title: 'Extract claims', detail: selectedFile ? selectedFile.name : 'Upload a pitch deck or document' },
          { icon: Github, label: '02 / REPOSITORY', title: 'Inspect code', detail: repoUrl.trim() ? 'Repository URL entered' : 'Connect a GitHub repository' },
          { icon: ShieldCheck, label: '03 / REPORT', title: 'Review findings', detail: 'Generate an evidence-led PDF' },
        ].map(({ icon: Icon, label, title, detail }) => (
          <div key={label} className="rounded-2xl border border-slate-700/60 bg-[#101b2c]/90 p-5">
            <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[10px] font-bold tracking-widest text-teal-300">{label}</span><Icon className="h-5 w-5 text-slate-500" /></div>
            <p className="text-sm font-bold text-white">{title}</p><p className="mt-1 truncate text-xs text-slate-400" title={detail}>{detail}</p>
          </div>
        ))}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-7">

        {/* Left 2 Cols: Document Upload & Claims Feed */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Target Repository (Preserved for future Phase 3 verification) */}
          <div className="p-6 rounded-2xl premium-panel">
            <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Github className="w-4 h-4 text-cyan-400" />
              GitHub Repository
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/organization/project-name"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Your selected claims will be compared with source code from this repository.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDiscoverRepositoryClaims}
                disabled={isDiscovering || isExtracting || !repoUrl.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isDiscovering ? 'Discovering documentation...' : 'Discover Claims from GitHub'}
              </button>
              <span className="text-xs text-slate-400">No README upload required</span>
            </div>
            {discoveryError && (
              <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-200">{discoveryError}</p>
            )}
          </div>

          {/* Section 2: Document Upload Area */}
          <div className="p-6 rounded-2xl premium-panel space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <span>Upload Project Documentation</span>
              </h2>
              <span className="text-xs font-mono text-cyan-400">DOCUMENT INPUT</span>
            </div>

            <DocumentUploadZone
              onExtract={handleExtractClaims}
              isLoading={isExtracting}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              error={extractionError}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
              <div>
                <p className="text-xs font-semibold text-amber-200">
                  Want to explore with sample data?
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Loads clearly labeled example claims without calling Gemini.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLoadDemoClaims}
                disabled={isExtracting}
                className="px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 disabled:opacity-50 text-xs font-semibold cursor-pointer"
              >
                Load Sample Claims
              </button>
            </div>


            {/* Helpful setup notice if GEMINI_API_KEY is missing */}
            {isMissingApiKey && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Gemini API Key Required</span>
                </div>
                <p className="leading-relaxed">
                  To extract claims using AI, configure your Gemini API key in{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 font-mono">
                    backend/.env
                  </code>
                  :
                </p>
                <pre className="p-2.5 rounded-lg bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto">
                  GEMINI_API_KEY=your_actual_key_here
                </pre>
                <p className="text-[11px] text-slate-400">
                  You can generate a free key at{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline hover:text-cyan-300"
                  >
                    Google AI Studio
                  </a>
                  . Once added, click &ldquo;Extract Claims&rdquo; again without restarting.
                </p>
              </div>
            )}
          </div>

          {/* Compact document tools — expanded only on demand */}
          {(
            <div className="rounded-2xl border border-slate-700/70 bg-[#101b2c]/90 p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">Claim tools</h3>
                  <p className="mt-1 max-w-lg truncate text-xs text-slate-400" title={documentPreview?.documentName || extractionResult?.documentName}>
                    {documentPreview?.documentName || extractionResult?.documentName || "Add claims manually without uploading a document"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {documentPreview && (
                    <button type="button" onClick={() => setPreviewExpanded((v) => !v)}
                      aria-expanded={previewExpanded} aria-controls="proofstack-document-preview"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                      <FileText className="h-3.5 w-3.5" /> {previewExpanded ? 'Hide preview' : 'View document'}
                      {previewExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button type="button" onClick={() => setManualExpanded((v) => !v)}
                    aria-expanded={manualExpanded} aria-controls="proofstack-manual-claim"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-500/20">
                    + {manualExpanded ? 'Close custom claim' : 'Add custom claim'}
                  </button>
                </div>
              </div>
              {fallbackNotice && <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200">{fallbackNotice}</p>}
              {documentPreview && previewExpanded && (
                <div id="proofstack-document-preview" className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <p className="mb-3 text-xs text-slate-400">{documentPreview.pageOrSlideCount ?? 'Unknown'} pages/slides</p>
                  <div className="max-h-72 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-300">{documentPreview.text}</pre>
                  </div>
                </div>
              )}
              {manualExpanded && (
                <div id="proofstack-manual-claim" className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <h4 className="text-sm font-bold text-white">Create a Technical Claim</h4>
                  <p className="text-xs text-slate-400">Enter a specific implementation claim to compare against the repository.</p>
                  <input type="text" value={manualClaimTitle} onChange={(e) => setManualClaimTitle(e.target.value)}
                    placeholder="Claim title (e.g. GitHub repository analysis)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500" />
                  <textarea value={manualClaimText} onChange={(e) => setManualClaimText(e.target.value)} rows={3}
                    placeholder="Describe the claimed feature or behavior..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500" />
                  <input type="text" value={manualClaimSource} onChange={(e) => setManualClaimSource(e.target.value)}
                    placeholder="Source (e.g. Slide 6)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white placeholder-slate-500" />
                  {manualClaimError && <p className="text-xs text-rose-300">{manualClaimError}</p>}
                  <button type="button" onClick={handleAddManualClaim}
                    className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400">
                    + Add Claim for Verification
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Compact claim manager: expansion never lengthens the whole page */}
          {extractionResult && (
            <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#101b2c]/95" aria-label="Technical claims manager">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-300" />
                      <h3 className="text-base font-bold text-white">Technical Claims</h3>
                      <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-200">{claims.length} found</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-400" title={extractionResult.documentName}>{extractionResult.documentName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClaimsExpanded((open) => !open)}
                    aria-expanded={claimsExpanded}
                    aria-controls="proofstack-claim-list"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    {claimsExpanded ? 'Close review' : 'Review & edit'}
                    {claimsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-3">
                  <p className="text-sm text-slate-300"><span className="font-bold text-white">{selectedClaimIds.size}</span><span className="text-slate-500"> / {claims.length}</span> selected for verification</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleSelectAll(true)} disabled={selectedClaimIds.size === claims.length}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                      Select all
                    </button>
                    <button type="button" onClick={() => handleSelectAll(false)} disabled={selectedClaimIds.size === 0}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                      Clear
                    </button>
                    <button type="button" onClick={() => {
                      claimCollectionRef.current = [];
                      setExtractionResult(null);
                      setSelectedClaimIds(new Set());
                      setDocumentPreview(null);
                      setSelectedFile(null);
                      setFallbackNotice(null);
                      setClaimsExpanded(false);
                    }} className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-950/40">
                      Clear all claims
                    </button>
                  </div>
                </div>

                <button type="button" onClick={jumpToVerification}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300">
                  Continue to Repository Verification <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {claimsExpanded && (
                <div id="proofstack-claim-list" className="border-t border-slate-700/70 bg-[#0b1423]/70 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search claims..."
                        aria-label="Search technical claims"
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none" />
                    </div>
                    {categories.length > 2 && (
                      <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                        aria-label="Filter claims by category"
                        className="max-w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-teal-400 focus:outline-none">
                        {categories.map((category) => <option key={category} value={category}>{category === 'ALL' ? 'All categories' : category}</option>)}
                      </select>
                    )}
                    <span className="text-xs text-slate-500">{filteredClaims.length} shown</span>
                  </div>
                  {extractionResult.explanation && (
                    <details className="mb-3 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                      <summary className="cursor-pointer font-medium text-slate-300">Extraction notes</summary>
                      <p className="mt-2 leading-relaxed">{extractionResult.explanation}</p>
                    </details>
                  )}
                  <div className="max-h-[380px] space-y-2 overflow-y-auto overscroll-contain pr-1" role="region" aria-label="Scrollable technical claims" tabIndex={0}>
                    {filteredClaims.length > 0 ? filteredClaims.map((claim) => (
                      <ClaimCard key={claim.id} claim={claim} isSelected={selectedClaimIds.has(claim.id)} onToggleSelect={handleToggleSelect} />
                    )) : (
                      <p className="rounded-xl border border-slate-700 p-5 text-center text-xs text-slate-400">No matching claims. Try a different search or category.</p>
                    )}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-500">Scroll inside this panel to review more claims. Your selections are saved automatically.</p>
                </div>
              )}
            </section>
          )}
          {/* Phase 3: GitHub Repository Analysis */}
          <div ref={verificationRef} className="scroll-mt-6">
            <RepositoryAnalyzer
              repoUrl={repoUrl}
              selectedClaims={claimsForVerification}
            />
          </div>
        </div>

        {/* Contextual sidebar */}
        <aside className="space-y-6">
          <div className="rounded-2xl premium-panel p-6">
            <div className="mb-5 flex items-center gap-2"><Layers className="h-5 w-5 text-teal-300" /><h2 className="text-sm font-bold text-white">Workspace overview</h2></div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3"><span className="text-xs text-slate-400">Document</span><span className="max-w-[135px] truncate text-xs font-semibold text-white" title={selectedFile?.name || ''}>{selectedFile ? selectedFile.name : 'Not uploaded'}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3"><span className="text-xs text-slate-400">Claims found</span><span className="text-sm font-bold text-white">{claims.length}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3"><span className="text-xs text-slate-400">Selected for review</span><span className="text-sm font-bold text-teal-300">{selectedClaimIds.size}</span></div>
              <div className="flex items-center justify-between rounded-xl bg-slate-900/70 p-3"><span className="text-xs text-slate-400">GitHub URL</span><span className={`text-xs font-semibold ${repoUrl.trim() ? 'text-teal-300' : 'text-slate-500'}`}>{repoUrl.trim() ? 'Entered' : 'Not entered'}</span></div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">This panel shows your current inputs, not verification results.</p>
          </div>

          <div className="rounded-2xl premium-panel p-6">
            <div className="mb-4 flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-cyan-300" /><h3 className="text-sm font-bold text-white">Supported documents</h3></div>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-cyan-300" /><span>Markdown / README files</span></div>
              <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-rose-300" /><span>PDF documents</span></div>
              <div className="flex items-center gap-3"><FileText className="h-4 w-4 text-amber-300" /><span>PowerPoint presentations</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
            <div className="mb-2 flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4" /><span className="text-xs font-bold">Evidence, not guarantees</span></div>
            <p className="text-xs leading-relaxed text-slate-400">Source-code matches are preliminary evidence. Runtime behavior is not tested automatically, and inconclusive claims should not be treated as verified.</p>
          </div>
        </aside>

      </div>

    </div>
  );
};
