
import type { Claim } from './claims';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface RepoMetadata {
    owner: string;
    repo: string;
    fullName: string;
    description?: string | null;
    stars: number;
    forks: number;
    defaultBranch: string;
    headCommitSha: string;
    primaryLanguage?: string | null;
    languages: Record<string, number>;
    htmlUrl: string;
}

export interface Dependency {
    manifestFile: string;
    name: string;
    version: string;
    type: string;
}

export interface RepositoryAnalysis {
    metadata: RepoMetadata;
    totalFilesCount: number;
    scannedFilesCount: number;
    isPartialScan: boolean;
    partialScanReason?: string;
    manifestsFound: string[];
    dependencies: Dependency[];
    keyFilesAnalyzed: string[];
}

export type EvidenceStatus =
    | 'EVIDENCE_FOUND'
    | 'LIMITED_EVIDENCE'
    | 'NO_EVIDENCE_FOUND'
    | 'INCONCLUSIVE';

export interface EvidenceSnippet {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    code: string;
    permalink: string;
    relevanceReason: string;
    kind: string;
}

export interface ImplementationTrailStep {
    caller: string;
    callee: string;
    filePath: string;
    line: number;
    permalink: string;
}

export interface ImplementationTrail {
    steps: ImplementationTrailStep[];
    description: string;
}

export interface ClaimEvidenceMatch {
    claimId: string;
    claimTitle?: string;
    claimCategory?: string;
    originalText?: string;
    runtimeStatus: string;
    codeEvidenceStatus: EvidenceStatus;
    assessmentReason: string;
    matchedDependencies: Dependency[];
    evidenceSnippets: EvidenceSnippet[];
    implementationTrail?: ImplementationTrail;
    confidenceScore: number;
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

async function postJSON<T>(
    endpoint: string,
    body: unknown
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(
            result.message ||
            result.error ||
            `Request failed: HTTP ${response.status}`
        );
    }

    return result.data as T;
}

export function analyzeRepository(
    repoUrl: string
): Promise<RepositoryAnalysis> {
    return postJSON<RepositoryAnalysis>(
        '/repository/analyze',
        { repoUrl }
    );
}

export function matchRepositoryClaims(
    repoUrl: string,
    claims: Claim[]
): Promise<MatchClaimsResult> {
    return postJSON<MatchClaimsResult>(
        '/repository/match-claims',
        { repoUrl, claims }
    );
}
