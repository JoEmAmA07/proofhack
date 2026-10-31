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
    const { analysis, analyzedFiles } = await this.analyzeRepository(rawUrl);

    const matches = ClaimMatcher.matchClaims(
      claims,
      analysis.metadata,
      analysis.dependencies,
      analyzedFiles,
      analysis.isPartialScan
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
   * Selects up to MAX_ANALYZED_FILES priority source files to analyze.
   * Prioritizes routes, controllers, middleware, models, server entrypoints, and core services.
   */
  private selectKeySourceFiles(entries: FileTreeEntry[]): string[] {
    const CODE_EXTENSIONS = new Set([
      'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php'
    ]);

    const EXCLUDED_PATTERNS = [
      'node_modules/', 'vendor/', 'dist/', 'build/', '.git/',
      'test/', 'tests/', '__tests__/', '.spec.', '.test.', 'min.js', 'bundle.js'
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
