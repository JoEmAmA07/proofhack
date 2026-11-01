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
const MAX_ANALYZED_FILES = 40;
const MAX_MANIFEST_FILES = 20;

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
      .map((entry) => entry.path)
      .filter((path) => ManifestParser.isManifest(path))
      .sort((a, b) => {
        // Root manifests first, then stable alphabetical ordering.
        const depthDifference = a.split('/').length - b.split('/').length;
        return depthDifference || a.localeCompare(b);
      });

    const dependencies: RepoAnalysisResult['dependencies'] = [];
    const manifestsAnalyzed: string[] = [];
    const manifestErrors: string[] = [];

    // Include supporting Gradle configuration without treating it as a manifest.
    // Fetch only bounded, relevant files; never execute repository code.
    const supportingGradlePaths = blobEntries
      .filter(entry => entry.type === 'blob')
      .map(entry => entry.path)
      .filter(path => {
        const name = path.split('/').pop()?.toLowerCase() ?? '';
        return name === 'gradle.properties' || name === 'libs.versions.toml' ||
          (/\.gradle(?:\.kts)?$/i.test(name) && !ManifestParser.isManifest(path));
      })
      .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      .slice(0, 20);

    const manifestSelection = manifestPaths.slice(0, MAX_MANIFEST_FILES);
    const contextFiles = new Map<string, string>();
    for (const path of [...new Set([...manifestSelection, ...supportingGradlePaths])]) {
      const content = await githubClient.getFileContent(owner, repo, path, metadata.headCommitSha);
      if (content !== null) {
        contextFiles.set(path, content);
      } else if (manifestSelection.includes(path)) {
        manifestErrors.push(path);
      }
    }

    for (const path of manifestSelection) {
      const content = contextFiles.get(path);
      if (content === undefined) continue;
      manifestsAnalyzed.push(path);
      const parsed = /(?:^|\/)build\.gradle(?:\.kts)?$/i.test(path)
        ? ManifestParser.parseGradleWithContext(path, content, contextFiles)
        : ManifestParser.parse(path, content);
      dependencies.push(...parsed);
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

    const eligibleSourceCount = blobEntries.filter((entry) => {
      const ext = entry.path.toLowerCase().split('.').pop() || '';
      return ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php'].includes(ext);
    }).length;
    const isPartialScan =
      eligibleSourceCount > analyzedFiles.length ||
      manifestPaths.length > manifestsAnalyzed.length;
    const partialScanReason = isPartialScan
      ? `Analyzed ${analyzedFiles.length} source files out of ${eligibleSourceCount} source candidates and ${manifestsAnalyzed.length} of ${manifestPaths.length} detected manifests.${manifestErrors.length ? ` ${manifestErrors.length} manifest fetch(es) failed.` : ''}`
      : undefined;

    const analysisResult: RepoAnalysisResult = {
      metadata,
      totalFilesCount: blobEntries.length,
      scannedFilesCount: analyzedFiles.length,
      isPartialScan,
      partialScanReason,
      manifestsFound: manifestsAnalyzed,
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

    console.log('\n========== PROOFSTACK DEBUG ==========');
    console.log('Repository:', analysis.metadata.fullName);
    console.log('Claims:', claims.map(c => c.title));
    console.log('Analyzed file count:', analyzedFiles.length);
    console.log('Analyzed file paths:');
    analyzedFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
      console.log(
        `   Functions: ${file.functions.map(f => f.name).slice(0, 12).join(', ')}`
      );
    });
    console.log('======================================\n');
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
      'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'rb', 'php',
    ]);
    const excludedSegments = new Set([
      'node_modules', 'vendor', 'dist', 'build', '.git', 'coverage',
      'test', 'tests', '__tests__', 'example', 'examples', 'demo',
      'demos', 'sample', 'samples', 'fixture', 'fixtures', 'doc', 'docs',
    ]);

    // Generic concept families are discovery hints, NOT implementation evidence.
    // E.g. routing -> route/router/dispatch; authentication -> auth/login/session.
    const conceptFamilies: string[][] = [
      ['route', 'routes', 'router', 'routing', 'dispatch', 'endpoint'],
      ['auth', 'authentication', 'authorization', 'login', 'session', 'token'],
      ['database', 'storage', 'persistence', 'repository', 'model', 'schema'],
      ['cache', 'caching', 'cached', 'redis'],
      ['test', 'testing', 'spec', 'coverage'],
      ['request', 'response', 'http', 'handler', 'middleware'],
      ['metrics', 'metric', 'telemetry', 'monitor', 'monitoring'],
      ['queue', 'worker', 'job', 'task'],
      ['config', 'configuration', 'settings', 'options'],
      ['validation', 'validate', 'validator', 'schema'],
      ['report', 'reporting', 'export', 'pdf'],
    ];
    const expandedTerms = new Set(terms);
    for (const family of conceptFamilies) {
      if (family.some((term) => expandedTerms.has(term))) {
        family.forEach((term) => expandedTerms.add(term));
      }
    }

    const baselineRank = new Map(baseline.map((path, index) => [path, index]));
    const candidates = entries
      .filter((entry) => {
        if (entry.type !== 'blob') return false;
        const lower = entry.path.toLowerCase();
        const segments = lower.split('/');
        const extension = lower.split('.').pop() || '';
        return sourceExtensions.has(extension) &&
          !segments.some((segment) => excludedSegments.has(segment)) &&
          !/\.(?:spec|test)\.|\.min\.js$|bundle\.js$/.test(lower);
      })
      .map((entry) => {
        const path = entry.path;
        const lower = path.toLowerCase();
        // Split camelCase BEFORE lowercasing, and split common separators.
        const tokens = path
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        const filename = path.split('/').pop() || '';
        const filenameTokens = filename
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .toLowerCase()
          .replace(/\.[^.]+$/, '')
          .split(/[^a-z0-9]+/)
          .filter(Boolean);

        let relevance = 0;
        for (const term of expandedTerms) {
          if (filenameTokens.includes(term)) relevance += 35;
          else if (tokens.includes(term)) relevance += 15;
          else if (term.length >= 5 && lower.includes(term)) relevance += 5;
        }
        // Retain an architectural prior without letting it dominate claim relevance.
        if (/^(src|lib|app|server|backend)\//i.test(path)) relevance += 12;
        if (baselineRank.has(path)) relevance += 8;
        return { path, relevance };
      })
      .sort((a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path));

    const selected: string[] = [];
    const seen = new Set<string>();
    const add = (path: string) => {
      if (selected.length < MAX_ANALYZED_FILES && !seen.has(path)) {
        selected.push(path);
        seen.add(path);
      }
    };

    // Preserve a small core sample; prioritize claim-relevant files thereafter.
    baseline.slice(0, 4).forEach(add);
    candidates.filter((candidate) => candidate.relevance >= 20)
      .forEach((candidate) => add(candidate.path));
    baseline.forEach(add);
    candidates.forEach((candidate) => add(candidate.path));
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
