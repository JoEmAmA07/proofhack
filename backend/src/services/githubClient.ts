import { RepoMetadata, FileTreeEntry } from '../types/repository.js';

export class GitHubApiError extends Error {
  public statusCode: number;
  public isRateLimit: boolean;
  public rateLimitResetDate?: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    isRateLimit: boolean = false,
    rateLimitResetDate?: Date
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.statusCode = statusCode;
    this.isRateLimit = isRateLimit;
    this.rateLimitResetDate = rateLimitResetDate;
  }
}

/**
 * Lightweight, typed client for GitHub's public REST API v3.
 * Supports unauthenticated access (60 req/hr) and optional GITHUB_TOKEN for higher limits.
 * All operations are strictly read-only and bounded by timeouts.
 */
export class GitHubClient {
  private token?: string;
  private baseUrl = 'https://api.github.com';
  private requestTimeoutMs = 15000;

  constructor() {
    this.token = process.env.GITHUB_TOKEN?.trim();

  }

  /**
   * Internal request helper with timeouts and rate-limit detection.
   */
  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ProofStack-Project-Verification-Engine/1.0',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if ((err as Error)?.name === 'AbortError') {
        throw new GitHubApiError(`GitHub API request timed out after ${this.requestTimeoutMs / 1000}s.`, 504);
      }
      const msg = err instanceof Error ? err.message : 'Network error reaching GitHub API';
      throw new GitHubApiError(`Failed to connect to GitHub API: ${msg}`, 502);
    } finally {
      clearTimeout(timeoutId);
    }

    // Inspect rate-limit headers
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');

    if (res.status === 403 && remaining === '0') {
      const resetTime = reset ? new Date(parseInt(reset, 10) * 1000) : undefined;
      const resetMsg = resetTime ? ` Rate limit resets at ${resetTime.toLocaleTimeString()}.` : '';
      throw new GitHubApiError(
        `GitHub API rate limit exceeded (60 requests/hour for unauthenticated access).${resetMsg}`,
        429,
        true,
        resetTime
      );
    }

    if (res.status === 404) {
      throw new GitHubApiError(
        'Repository not found. Please verify the URL or ensure the repository is public.',
        404
      );
    }

    if (!res.ok) {
      let errorBody = '';
      try {
        const json = await res.json();
        errorBody =
          typeof json === 'object' &&
            json !== null &&
            'message' in json &&
            typeof json.message === 'string'
            ? json.message
            : '';
      } catch (_e) {
        errorBody = await res.text();
      }
      throw new GitHubApiError(
        `GitHub API returned HTTP ${res.status}: ${errorBody || res.statusText}`,
        res.status
      );
    }

    return (await res.json()) as T;
  }

  /**
   * Fetches metadata for a public repository.
   */
  public async getRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
    interface GitHubRepoResponse {
      name: string;
      full_name: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      open_issues_count: number;
      default_branch: string;
      private: boolean;
      archived: boolean;
      html_url: string;
      language: string | null;
    }

    const repoData = await this.request<GitHubRepoResponse>(`/repos/${owner}/${repo}`);

    if (repoData.private) {
      throw new GitHubApiError(
        `Repository "${owner}/${repo}" is private. ProofStack only analyzes public repositories for security reasons.`,
        403
      );
    }

    // Fetch languages and default branch commit in parallel
    const [languages, headCommitSha] = await Promise.all([
      this.getLanguages(owner, repo),
      this.getHeadCommitSha(owner, repo, repoData.default_branch),
    ]);

    return {
      owner,
      repo,
      fullName: repoData.full_name,
      description: repoData.description,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      defaultBranch: repoData.default_branch,
      headCommitSha,
      isPrivate: repoData.private,
      isArchived: repoData.archived,
      languages,
      primaryLanguage: repoData.language,
      htmlUrl: repoData.html_url,
    };
  }

  /**
   * Fetches the language breakdown for a repository.
   */
  public async getLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    try {
      return await this.request<Record<string, number>>(`/repos/${owner}/${repo}/languages`);
    } catch (_e) {
      return {};
    }
  }

  /**
   * Fetches the latest commit SHA for a branch.
   */
  public async getHeadCommitSha(owner: string, repo: string, branch: string): Promise<string> {
    try {
      interface CommitRef {
        sha: string;
      }
      const data = await this.request<CommitRef>(`/repos/${owner}/${repo}/commits/${branch}`);
      return data.sha || branch;
    } catch (_e) {
      return branch;
    }
  }

  /**
   * Fetches the complete recursive Git tree for a commit or branch.
   */
  public async getFileTree(owner: string, repo: string, commitSha: string): Promise<FileTreeEntry[]> {
    interface TreeResponse {
      sha: string;
      tree: Array<{
        path: string;
        mode: string;
        type: 'blob' | 'tree';
        sha: string;
        size?: number;
      }>;
      truncated: boolean;
    }

    try {
      const data = await this.request<TreeResponse>(
        `/repos/${owner}/${repo}/git/trees/${commitSha}?recursive=1`
      );

      if (!data.tree || data.tree.length === 0) {
        return [];
      }

      return data.tree.map((item) => ({
        path: item.path,
        type: item.type,
        size: item.size,
        sha: item.sha,
      }));
    } catch (err: unknown) {
      if (err instanceof GitHubApiError && err.statusCode === 404) {
        // If git tree endpoint fails, return empty array
        return [];
      }
      throw err;
    }
  }

  /**
   * Fetches the decoded textual content of a file from the repository.
   * Enforces a maximum file size limit (200 KB) to prevent excessive memory usage.
   */
  public async getFileContent(
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    maxSizeBytes = 200 * 1024
  ): Promise<string | null> {
    interface ContentResponse {
      type: string;
      encoding?: string;
      size: number;
      name: string;
      path: string;
      content?: string;
    }

    try {
      const data = await this.request<ContentResponse>(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`
      );

      if (data.type !== 'file' || !data.content) {
        return null;
      }

      if (data.size > maxSizeBytes) {
        // Skip files that exceed our analysis limit
        return null;
      }

      if (data.encoding === 'base64') {
        const buffer = Buffer.from(data.content, 'base64');
        return buffer.toString('utf-8');
      }

      return data.content;
    } catch (_e) {
      return null;
    }
  }
}

export const githubClient = new GitHubClient();
