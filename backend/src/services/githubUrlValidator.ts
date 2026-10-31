import { RepoIdentifier } from '../types/repository.js';

export class GitHubUrlError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'GitHubUrlError';
    this.statusCode = statusCode;
  }
}

// GitHub reserved paths that are not repositories
const RESERVED_NAMES = new Set([
  'settings',
  'organizations',
  'orgs',
  'marketplace',
  'features',
  'explore',
  'trending',
  'topics',
  'collections',
  'events',
  'pricing',
  'login',
  'join',
  'logout',
  'security',
  'about',
  'contact',
  'pricing',
  'site',
]);

// Valid GitHub username/org and repo name regex:
// alphanumeric, hyphen, underscore, and dot (repo names can contain dots, e.g. "my.project")
const GITHUB_NAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9_.-]{0,99})$/;

/**
 * Validates and normalizes public GitHub repository URLs.
 * Strictly prevents SSRF by rejecting non-github.com hosts, internal IPs, and malformed paths.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo (auto-upgrades to https)
 * - https://www.github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/
 */
export function validateAndParseGitHubUrl(rawUrl: string): RepoIdentifier {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new GitHubUrlError('Repository URL must be a non-empty string.', 400);
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (_e) {
    throw new GitHubUrlError(
      `Invalid URL format: "${trimmed}". Please provide a valid GitHub repository URL (e.g. https://github.com/owner/repo).`,
      400
    );
  }

  // 1. Strict Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new GitHubUrlError(
      `Unsupported protocol "${parsed.protocol}". Only HTTPS GitHub URLs are accepted.`,
      400
    );
  }

  // 2. Strict Host check (SSRF prevention)
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    throw new GitHubUrlError(
      `Unsupported host "${hostname}". ProofStack currently verifies public GitHub repositories hosted on github.com.`,
      400
    );
  }

  // 3. Strict Path parsing
  // Path should be /owner/repo or /owner/repo.git
  const pathSegments = parsed.pathname
    .split('/')
    .filter((segment) => segment.trim().length > 0);

  if (pathSegments.length < 2) {
    throw new GitHubUrlError(
      'Incomplete GitHub URL. The URL must contain both owner and repository name (e.g. https://github.com/owner/repo).',
      400
    );
  }

  if (pathSegments.length > 2 && pathSegments[2] !== '') {
    // If user provided a subpath e.g. /owner/repo/tree/main, inform them
    throw new GitHubUrlError(
      'Please provide the base repository URL (https://github.com/owner/repo) rather than a deep file or branch path.',
      400
    );
  }

  const owner = pathSegments[0].trim();
  let repo = pathSegments[1].trim();

  // Strip optional .git suffix
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  // Validate owner
  if (!GITHUB_NAME_REGEX.test(owner) || RESERVED_NAMES.has(owner.toLowerCase())) {
    throw new GitHubUrlError(
      `Invalid GitHub repository owner name: "${owner}".`,
      400
    );
  }

  // Validate repo
  if (!GITHUB_NAME_REGEX.test(repo) || repo === '.' || repo === '..') {
    throw new GitHubUrlError(
      `Invalid GitHub repository name: "${repo}".`,
      400
    );
  }

  return {
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}
