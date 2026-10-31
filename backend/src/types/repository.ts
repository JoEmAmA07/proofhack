import { Claim } from './claims.js';

export interface RepoIdentifier {
  owner: string;
  repo: string;
  canonicalUrl: string;
}

export interface RepoMetadata {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  headCommitSha: string;
  isPrivate: boolean;
  isArchived: boolean;
  languages: Record<string, number>;
  primaryLanguage: string | null;
  htmlUrl: string;
}

export interface FileTreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

export interface ManifestDependency {
  manifestFile: string;
  name: string;
  version?: string;
  type: 'runtime' | 'dev';
}

export type EvidenceKind =
  | 'manifest'
  | 'import'
  | 'function'
  | 'class'
  | 'route'
  | 'schema'
  | 'config'
  | 'text_match'
  | 'function_call';

export interface CodeEvidenceSnippet {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  code: string;
  permalink: string;
  relevanceReason: string;
  kind: EvidenceKind;
}

export type CodeEvidenceStatus =
  | 'EVIDENCE_FOUND'
  | 'LIMITED_EVIDENCE'
  | 'NO_EVIDENCE_FOUND'
  | 'INCONCLUSIVE';

export interface ClaimEvidenceMatch {
  claimId: string;
  claimTitle: string;
  claimCategory: string;
  originalText?: string;
  runtimeStatus: 'NOT_TESTED'; // Strictly NOT_TESTED, never false VERIFIED
  codeEvidenceStatus: CodeEvidenceStatus;
  assessmentReason: string;
  matchedDependencies: ManifestDependency[];
  evidenceSnippets: CodeEvidenceSnippet[];
  confidenceScore: number; // 0 - 100
}
export interface FunctionCall {
  caller: string;
  callee: string;
  line: number;
}

export interface AnalyzedFile {
  path: string;
  language: string;
  size: number;
  content: string;
  imports: string[];
  functions: Array<{ name: string; lineStart: number; lineEnd: number }>;
  classes: Array<{ name: string; lineStart: number; lineEnd: number }>;
  routes: Array<{ method: string; path: string; lineStart: number; lineEnd: number }>;
  calls?: FunctionCall[];
}


export interface RepoAnalysisResult {
  metadata: RepoMetadata;
  totalFilesCount: number;
  scannedFilesCount: number;
  isPartialScan: boolean;
  partialScanReason?: string;
  manifestsFound: string[];
  dependencies: ManifestDependency[];
  keyFilesAnalyzed: string[];
}

export interface MatchClaimsRequest {
  repoUrl: string;
  claims: Claim[];
}

export interface MatchClaimsResult {
  repoMetadata: RepoMetadata;
  totalClaimsEvaluated: number;
  summary: {
    evidenceFound: number;
    limitedEvidence: number;
    noEvidenceFound: number;
    inconclusive: number;
  };
  matches: ClaimEvidenceMatch[];
}
