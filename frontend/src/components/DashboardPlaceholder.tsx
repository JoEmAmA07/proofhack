import React, { useState } from 'react';
import {
  Github,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  Search,
  Filter,
  SlidersHorizontal,
  Key,
} from 'lucide-react';
import { HealthResponse } from '../api/health';
import { ExtractionResult, uploadAndExtractClaims } from '../api/claims';
import { DocumentUploadZone } from './DocumentUploadZone';
import { ClaimCard } from './ClaimCard';
import { RepositoryAnalyzer } from './RepositoryAnalyzer';

interface DashboardPlaceholderProps {
  onBackToLanding: () => void;
  backendInfo?: HealthResponse;
}

export const DashboardPlaceholder: React.FC<DashboardPlaceholderProps> = ({
  onBackToLanding,
  backendInfo,
}) => {
  // Target Repo state (Preserved for Phase 3)
  const [repoUrl, setRepoUrl] = useState('');

  // Document Upload & Extraction state (Phase 2)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Selected Claims for future verification
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Trigger claim extraction
  const handleExtractClaims = async (file: File) => {
    setIsExtracting(true);
    setExtractionError(null);

    const res = await uploadAndExtractClaims(file);

    setIsExtracting(false);

    if (!res.success || !res.data) {
      setExtractionError(res.error || 'Failed to extract claims from document.');
      return;
    }

    setExtractionResult(res.data);
    // By default select all extracted claims
    const allIds = new Set(res.data.claims.map((c) => c.id));
    setSelectedClaimIds(allIds);
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

    setExtractionResult({
      documentName: 'DEMO — Express.js Sample Claims',
      documentType: 'markdown',
      totalClaims: demoClaims.length,
      explanation:
        'Demo Mode: these are predefined sample claims, not AI-extracted claims from the uploaded document.',
      claims: demoClaims,
    });

    setSelectedClaimIds(new Set(demoClaims.map((claim) => claim.id)));
    setExtractionError(null);
    setSearchQuery('');
    setSelectedCategory('ALL');
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
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <button
            onClick={onBackToLanding}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-300 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Overview
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Verification Studio</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-950/40 text-cyan-300">
              Phase 2 Active
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Upload project documentation to extract concrete, testable claims via Gemini AI.
          </p>
        </div>

        {/* Backend Connectivity Status Card */}
        <div className="p-3 rounded-xl border border-slate-800 bg-brand-surface/70 text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span>API Server:</span>
            <span className="text-teal-400 font-bold">
              {backendInfo ? 'Connected' : 'Active (Polling)'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Endpoint: <span className="text-slate-300 font-mono">/api/claims/extract</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">

        {/* Left 2 Cols: Document Upload & Claims Feed */}
        <div className="lg:col-span-2 space-y-8">

          {/* Section 1: Target Repository (Preserved for future Phase 3 verification) */}
          <div className="p-5 rounded-2xl bg-brand-surface/70 border border-brand-border/70">
            <label className="block text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Github className="w-4 h-4 text-cyan-400" />
              Target GitHub Repository (Optional for Extraction)
            </label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/organization/project-name"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              This repository will be scanned against your selected claims in Phase 3.
            </p>
          </div>

          {/* Section 2: Document Upload Area */}
          <div className="p-6 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <span>Upload Project Documentation</span>
              </h2>
              <span className="text-xs font-mono text-cyan-400">Step 1 of Verification</span>
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
                  Gemini unavailable? Test with Demo Mode
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Loads predefined Express.js claims. No Gemini API call required.
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

          {/* Section 3: Extracted Claims Feed */}
          {extractionResult && (
            <div className="space-y-5">

              {/* Claims Header & Selection Controls */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Extracted Technical Claims</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-950 border border-cyan-500/30 text-cyan-300">
                      {extractionResult.totalClaims} Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">
                    Document: {extractionResult.documentName} &bull; {selectedClaimIds.size} of{' '}
                    {extractionResult.totalClaims} selected for verification
                  </p>
                </div>

                {/* Bulk Select / Deselect */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectAll(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Select All</span>
                  </button>
                  <button
                    onClick={() => handleSelectAll(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deselect All</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search claims by keyword, technology, or category..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-brand-surface border border-slate-700/80 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                {/* Category Filter Pills */}
                {categories.length > 2 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
                    <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {categories.slice(0, 4).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === cat
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Explanation message if present */}
              {extractionResult.explanation && (
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 text-xs text-slate-300">
                  <span className="font-semibold text-cyan-300">Auditor Summary:</span>{' '}
                  {extractionResult.explanation}
                </div>
              )}

              {/* Claims Cards Grid */}
              {filteredClaims.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {filteredClaims.map((claim) => (
                    <ClaimCard
                      key={claim.id}
                      claim={claim}
                      isSelected={selectedClaimIds.has(claim.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-slate-800 bg-brand-surface/40 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-300">No matching claims found.</p>
                  <p className="text-xs text-slate-500">
                    Try adjusting your search query or category filter.
                  </p>
                </div>
              )}

            </div>
          )}
          {/* Phase 3: GitHub Repository Analysis */}
          <RepositoryAnalyzer
            repoUrl={repoUrl}
            selectedClaims={claimsForVerification}
          />
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
                  Done
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-cyan-300">
                <span className="font-medium">Phase 2: Document Upload & Gemini Extraction</span>
                <span className="font-mono text-[10px] uppercase font-bold bg-cyan-500/20 px-2 py-0.5 rounded animate-pulse">
                  Active
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                <span>Phase 3: GitHub Repo Deep AST Scan</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">Next</span>
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

          {/* Verification Scope Info */}
          <div className="p-5 rounded-2xl bg-brand-surface/70 border border-brand-border/70 space-y-3 text-xs text-slate-400">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              Document Formats Handled
            </h3>
            <ul className="space-y-2 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0"></span>
                <span><strong>Markdown (.md):</strong> Section titles & feature bullets.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
                <span><strong>PDF (.pdf):</strong> Page-by-page text with page number citations.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                <span><strong>PPTX (.pptx):</strong> Slide deck XML parsing with slide number citations.</span>
              </li>
            </ul>
          </div>

          {/* Honest Verification Notice */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200/90 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 font-semibold block mb-0.5">Integrity Guard</strong>
              ProofStack extracts real claims directly from your files. If no API key is provided or no testable claims exist, an honest report is returned.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
