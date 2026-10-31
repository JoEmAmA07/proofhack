import { validateAndParseGitHubUrl } from './githubUrlValidator.js';
import { githubClient } from './githubClient.js';
import { ManifestParser } from './manifestParser.js';
import { CodeAnalyzer } from './codeAnalyzer.js';
import { ClaimMatcher } from './claimMatcher.js';
import { Claim } from '../types/claims.js';
import {
  AnalyzedFile,
  FileTreeEntry,
  MatchClaimsResult,
  RepoAnalysisResult,
  RepoMetadata,
} from '../types/repository.js';

// Maximum candidate source files fetched for deep code analysis (keeps rate-limit & latency low)
const MAX_ANALYZED_FILES = 15;

const CLAIM_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that',
  'have', 'has', 'using', 'uses', 'used', 'into',
  'application', 'project', 'system', 'feature',
  'supports', 'support', 'implementation',
  'implement', 'check', 'inspect', 'verify',
  'code', 'source', 'function', 'functions',
]);

function getClaimSearchTerms(claims: Claim[]): string[] {
  const terms = new Set<string>();

  for (const claim of claims) {
    const text = [
      claim.title,
      claim.originalText,
      claim.category,
      ...(claim.proposedChecks || []),
    ].join(' ').toLowerCase();

    for (const word of text.match(/[a-z][a-z0-9_-]*/g) || []) {
      if (word.length >= 4 && !CLAIM_STOP_WORDS.has(word)) {
        terms.add(word);
      }
    }
  }

  return [...terms];
}


interface CachedAnalysis {
  timestamp: number;
  metadata: RepoMetadata;
  analysis: RepoAnalysisResult;
  analyzedFiles: AnalyzedFile[];
}

export class RepositoryService {
  // In-memory cache for 10 minutes to prevent duplicate GitHub API calls
  private cache = new Map<string, CachedAnalysis>();
  private CACHE_TTL_MS = 10 * 60 * 1000;

  /**
   * Analyzes a public GitHub repository: fetches metadata, file tree, manifests, and key source files.
   */
  public async analyzeRepository(rawUrl: string): Promise<{
    analysis: RepoAnalysisResult;
    analyzedFiles: AnalyzedFile[];
  }> {
    const { owner, repo, canonicalUrl } = validateAndParseGitHubUrl(rawUrl);

    // Check cache
    const cached = this.cache.get(canonicalUrl);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return {
        analysis: cached.analysis,
        analyzedFiles: cached.analyzedFiles,
      };
    }

    // 1. Fetch metadata & commit SHA
    const metadata = await githubClient.getRepoMetadata(owner, repo);

    // 2. Fetch recursive file tree
    const tree = await githubClient.getFileTree(owner, repo, metadata.headCommitSha);
    const blobEntries = tree.filter((entry) => entry.type === 'blob');

    // 3. Find and parse manifest files
    const manifestPaths = blobEntries
      .map((e) => e.path)
      .filter((p) => ManifestParser.isManifest(p));

    const dependencies = [];
    for (const mPath of manifestPaths.slice(0, 5)) {
      const content = await githubClient.getFileContent(
        owner,
        repo,
        mPath,
        metadata.headCommitSha
      );
      if (content) {
        const parsed = ManifestParser.parse(mPath, content);
        dependencies.push(...parsed);
      }
    }

    // 4. Select candidate key source files for analysis
    const candidateFiles = this.selectKeySourceFiles(blobEntries);
    const analyzedFiles: AnalyzedFile[] = [];

    for (const cPath of candidateFiles) {
      const content = await githubClient.getFileContent(
        owner,
        repo,
        cPath,
        metadata.headCommitSha
      );
      if (content) {
        const analyzed = CodeAnalyzer.analyze(cPath, content);
        analyzedFiles.push(analyzed);
      }
    }

    const isPartialScan = blobEntries.length > analyzedFiles.length;
    const partialScanReason = isPartialScan
      ? `Repository has ${blobEntries.length} files. ProofStack analyzed ${analyzedFiles.length} priority source files and ${manifestPaths.length} package manifest(s).`
      : undefined;

    const analysisResult: RepoAnalysisResult = {
      metadata,
      totalFilesCount: blobEntries.length,
      scannedFilesCount: analyzedFiles.length,
      isPartialScan,
      partialScanReason,
      manifestsFound: manifestPaths,
      dependencies,
      keyFilesAnalyzed: analyzedFiles.map((f) => f.path),
    };

    // Store in cache
    this.cache.set(canonicalUrl, {
      timestamp: Date.now(),
      metadata,
      analysis: analysisResult,
      analyzedFiles,
    });

    return {
      analysis: analysisResult,
      analyzedFiles,
    };
  }

  /**
   * Matches technical claims against analyzed repository files.
   */
  public async matchClaims(rawUrl: string, claims: Claim[]): Promise<MatchClaimsResult> {

    const { analysis, analyzedFiles: baselineFiles } =
      await this.analyzeRepository(rawUrl);

    const { owner, repo } = validateAndParseGitHubUrl(rawUrl);

    const tree = await githubClient.getFileTree(
      owner,
      repo,
      analysis.metadata.headCommitSha
    );

    const selectedPaths = this.selectClaimAwareFiles(tree, claims);

    const baselineByPath = new Map(
      baselineFiles.map((file) => [file.path, file])
    );

    const analyzedFiles: AnalyzedFile[] = [];

    for (const path of selectedPaths) {
      const existing = baselineByPath.get(path);

      if (existing) {
        analyzedFiles.push(existing);
        continue;
      }

      const content = await githubClient.getFileContent(
        owner,
        repo,
        path,
        analysis.metadata.headCommitSha
      );

      if (content !== null) {
        analyzedFiles.push(CodeAnalyzer.analyze(path, content));
      }
    }

    const claimAwarePartialScan =
      tree.filter((entry) => {
        if (entry.type !== 'blob') return false;

        const lower = entry.path.toLowerCase();
        const extension = lower.split('.').pop() || '';

        return [
          'ts', 'tsx', 'js', 'jsx',
          'py', 'go', 'rs', 'java', 'rb', 'php',
        ].includes(extension);
      }).length > analyzedFiles.length;


    const matches = ClaimMatcher.matchClaims(
      claims,
      analysis.metadata,
      analysis.dependencies,
      analyzedFiles,
      claimAwarePartialScan
    );

    const summary = {
      evidenceFound: matches.filter((m) => m.codeEvidenceStatus === 'EVIDENCE_FOUND').length,
      limitedEvidence: matches.filter((m) => m.codeEvidenceStatus === 'LIMITED_EVIDENCE').length,
      noEvidenceFound: matches.filter((m) => m.codeEvidenceStatus === 'NO_EVIDENCE_FOUND').length,
      inconclusive: matches.filter((m) => m.codeEvidenceStatus === 'INCONCLUSIVE').length,
    };

    return {
      repoMetadata: analysis.metadata,
      totalClaimsEvaluated: claims.length,
      summary,
      matches,
    };
  }

  /**
   * Selects candidate source files using claim terminology.
   * Filename relevance is only a discovery hint,
   * not evidence that the feature is implemented.
   */
  private selectClaimAwareFiles(
    entries: FileTreeEntry[],
    claims: Claim[]
  ): string[] {
    const baseline = this.selectKeySourceFiles(entries);
    const terms = getClaimSearchTerms(claims);

    const sourceExtensions = new Set([
      'ts', 'tsx', 'js', 'jsx', 'py',
      'go', 'rs', 'java', 'rb', 'php',
    ]);

    const excludedSegments = new Set([
      'node_modules', 'vendor', 'dist', 'build',
      '.git', 'coverage', 'test', 'tests',
      '__tests__', 'example', 'examples',
      'demo', 'demos', 'sample', 'samples',
      'fixture', 'fixtures', 'doc', 'docs',
    ]);

    const candidates = entries
      .filter((entry) => {
        if (entry.type !== 'blob') return false;

        const path = entry.path.toLowerCase();
        const segments = path.split('/');
        const extension = path.split('.').pop() || '';

        if (!sourceExtensions.has(extension)) return false;

        if (segments.some((segment) => excludedSegments.has(segment))) {
          return false;
        }

        if (
          path.includes('.spec.') ||
          path.includes('.test.') ||
          path.endsWith('.min.js') ||
          path.endsWith('bundle.js')
        ) {
          return false;
        }

        return true;
      })
      .map((entry) => {
        const path = entry.path;
        const lower = path.toLowerCase();

        const filename = lower.split('/').pop() || '';
        const filenameTokens = filename
          .replace(/\.[^.]+$/, '')
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .split(/[^a-z0-9]+/);

        let relevance = 0;

        for (const term of terms) {
          if (filenameTokens.includes(term)) {
            relevance += 50;
          } else if (lower.includes(term)) {
            relevance += 15;
          }
        }

        if (baseline.includes(path)) {
          relevance += 10;
        }

        return { path, relevance };
      });

    candidates.sort(
      (a, b) =>
        b.relevance - a.relevance ||
        a.path.localeCompare(b.path)
    );


    // Combine claim-relevant files with baseline implementation files.
    // A weak filename match must not discard core application files.
    const claimRelevant = candidates
      .filter((candidate) => candidate.relevance > 10)
      .map((candidate) => candidate.path);

    const selected: string[] = [];
    const seen = new Set<string>();

    const addFile = (path: string) => {
      if (
        !seen.has(path) &&
        selected.length < MAX_ANALYZED_FILES
      ) {
        selected.push(path);
        seen.add(path);
      }
    };

    // Reserve up to 7 slots for important baseline files.
    for (const path of baseline.slice(0, 7)) {
      addFile(path);
    }

    // Use remaining slots for claim-relevant files.
    for (const path of claimRelevant) {
      addFile(path);
    }

    // Fill any remaining capacity with baseline files.
    for (const path of baseline) {
      addFile(path);
    }

    return selected;

  }

  /**
   * Selects up to MAX_ANALYZED_FILES priority source files to analyze.
   * Prioritizes routes, controllers, middleware, models, server entrypoints, and core services.
   */
  private selectKeySourceFiles(entries: FileTreeEntry[]): string[] {
    const CODE_EXTENSIONS = new Set([
      'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php'
    ]);


    const EXCLUDED_PATTERNS = [
      'node_modules/',
      'vendor/',
      'dist/',
      'build/',
      '.git/',
      'coverage/',
      'test/',
      'tests/',
      '__tests__/',
      '.spec.',
      '.test.',
      '.min.js',
      'bundle.js',
      'examples/',
      'example/',
      'demos/',
      'demo/',
      'samples/',
      'sample/',
      'fixtures/',
      'docs/',
      'doc/',
    ];


    const eligible = entries
      .filter((e) => {
        const lower = e.path.toLowerCase();
        const ext = lower.split('.').pop() || '';
        if (!CODE_EXTENSIONS.has(ext)) return false;
        if (EXCLUDED_PATTERNS.some((pattern) => lower.includes(pattern))) return false;
        return true;
      })
      .map((e) => e.path);


    // Score priority based on architectural significance
    const scored = eligible.map((path) => {
      const lower = path.toLowerCase();
      let score = 0;

      // Prioritize real implementation directories
      if (/^(src|lib|app|server|backend)\//.test(lower)) score += 70;
      if (/(^|\/)(src|lib|app|server)\//.test(lower)) score += 35;

      // Deprioritize demos, examples, and documentation
      if (/(^|\/)(examples?|demos?|samples?|docs?|fixtures?)\//.test(lower)) {
        score -= 100;
      }

      // Important implementation files
      if (/(^|\/)(index|main|app|server|express)\.[^.]+$/.test(lower)) {
        score += 20;
      }

      // Architectural components
      if (/(^|\/)(routes?|routers?|api)\//.test(lower)) score += 30;
      if (/(^|\/)(controllers?|handlers?)\//.test(lower)) score += 25;
      if (/(^|\/)(models?|schemas?|database|db)\//.test(lower)) score += 20;
      if (/(^|\/)(middleware|services?|auth)\//.test(lower)) score += 20;

      // Useful filenames
      if (/router|controller|handler|middleware|service|auth/.test(lower)) {
        score += 15;
      }

      // Slight preference for shallower files
      score -= Math.min(path.split('/').length, 10) * 2;

      return { path, score };
    });

    // Highest-priority files first, with deterministic tie-breaking
    scored.sort((a, b) =>
      b.score - a.score || a.path.localeCompare(b.path)
    );

    return scored.slice(0, MAX_ANALYZED_FILES).map((s) => s.path);
  }
}

export const repositoryService = new RepositoryService();
