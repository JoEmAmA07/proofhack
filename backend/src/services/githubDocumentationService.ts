import { githubClient } from './githubClient.js';
import { validateAndParseGitHubUrl } from './githubUrlValidator.js';
import { suggestClaimsFromText, type SuggestedClaim } from './claimSuggestionService.js';

export interface DocumentationDiscoveryResult {
  repository: string;
  documents: Array<{ path: string; claimCount: number }>;
  claims: SuggestedClaim[];
  totalClaims: number;
  explanation: string;
}

const MAX_DOCUMENTS = 12;
const MAX_DOC_BYTES = 120 * 1024;
const MAX_CLAIMS = 20;
const MAX_FETCH_ATTEMPTS = MAX_DOCUMENTS * 2;
const SKIP_DIRS = /(^|\/)(node_modules|vendor|dist|build|coverage|\.github|changelog|archive)(\/|$)/i;
const IGNORE_DOC = /(^|\/)(license|contributing|code-of-conduct|changelog|authors|credits|additional-resources)\.md$/i;
const README = /(^|\/)readme(?:\.[a-z-]+)?\.md$/i;
const TOPIC = /(?:^|[-_/])(features?|capabilities|architecture|design|overview|project-structure|application-overview|api-layer|state-management|security|testing|error-handling|components-and-styling|deployment|configuration|routing|middleware|authentication|validation|performance|getting-started)(?:[-_/.]|$)/i;
const LANGUAGE_CODES = new Set([
  'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'es', 'et', 'fa', 'fi', 'fr', 'he', 'hi', 'hr', 'hu', 'id', 'it',
  'ja', 'ko', 'lt', 'lv', 'ms', 'nl', 'no', 'pl', 'pt', 'pt-br', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'ta', 'th', 'tr',
  'uk', 'ur', 'vi', 'zh', 'zh-cn', 'zh-tw', 'zh-hans', 'zh-hant',
]);

function isTranslation(path: string): boolean {
  const parts = path.toLowerCase().split('/');
  // Detect language directories in documentation trees, e.g. docs/de/docs/features.md.
  return parts.some((part, index) =>
    index > 0 && LANGUAGE_CODES.has(part) &&
    parts.slice(0, index).some((parent) => parent === 'docs' || parent === 'documentation' || parent === 'i18n' || parent === 'locales')
  );
}

function normalizePath(base: string, target: string): string | null {
  if (!target || /^(?:[a-z]+:|\/\/|#|mailto:)/i.test(target)) return null;
  const clean = decodeURIComponent(target.split('#')[0].split('?')[0]);
  const segments = [...base.split('/').filter(Boolean), ...clean.split('/')];
  const output: string[] = [];
  for (const part of segments) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!output.length) return null;
      output.pop();
    } else {
      output.push(part);
    }
  }
  const result = output.join('/');
  return result.toLowerCase().endsWith('.md') ? result : null;
}

function markdownLinks(text: string, sourcePath: string): string[] {
  const base = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : '';
  const results: string[] = [];
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^<|>$/g, '').split(/\s+["']/)[0];
    try {
      const normalized = normalizePath(base, raw);
      if (normalized) results.push(normalized);
    } catch {
      // Ignore malformed URL escapes in untrusted repository Markdown.
    }
  }
  return results;
}

function rankDocument(path: string, linkedFromRoot: boolean): number {
  const lower = path.toLowerCase();
  const depth = lower.split('/').length;
  let score = 0;
  if (lower === 'readme.md') score += 1000;
  else if (/^readme(?:\.[a-z-]+)?\.md$/.test(lower)) score += 800;
  if (isTranslation(lower)) score -= 1000;
  if (/(^|\/)en(?:-us|-gb)?\//.test(lower)) score += 180;
  if (TOPIC.test(lower)) score += 170;
  if (linkedFromRoot) score += 140;
  if (/^(docs|documentation)\//.test(lower)) score += 70;
  if (README.test(lower)) score += 30;
  score -= depth * 6;
  return score;
}

export async function discoverRepositoryClaims(repoUrl: string): Promise<DocumentationDiscoveryResult> {
  const { owner, repo } = validateAndParseGitHubUrl(repoUrl);
  const metadata = await githubClient.getRepoMetadata(owner, repo);
  const tree = await githubClient.getFileTree(owner, repo, metadata.headCommitSha);
  const files = new Map(
    tree.filter((entry) => entry.type === 'blob'
      && entry.path.toLowerCase().endsWith('.md')
      && !SKIP_DIRS.test(entry.path)
      && !IGNORE_DOC.test(entry.path)
      && (entry.size === undefined || entry.size <= MAX_DOC_BYTES))
      .map((entry) => [entry.path.toLowerCase(), entry.path])
  );

  const rootReadme = files.get('readme.md');
  const seen = new Set<string>();
  const linkedFromRoot = new Set<string>();
  const documents: DocumentationDiscoveryResult['documents'] = [];
  const claims: SuggestedClaim[] = [];
  const claimKeys = new Set<string>();
  let attempts = 0;

  async function processFile(path: string): Promise<string | null> {
    if (seen.has(path.toLowerCase()) || documents.length >= MAX_DOCUMENTS || attempts >= MAX_FETCH_ATTEMPTS) return null;
    seen.add(path.toLowerCase());
    attempts++;
    const content = await githubClient.getFileContent(owner, repo, path, metadata.headCommitSha, MAX_DOC_BYTES);
    if (content === null) return null;
    const extracted = suggestClaimsFromText(content);
    documents.push({ path, claimCount: extracted.length });
    for (const claim of extracted) {
      const key = `${claim.title.toLowerCase().replace(/[^a-z0-9]/g, '')}:${claim.originalText.toLowerCase().slice(0, 80)}`;
      if (claimKeys.has(key) || claims.length >= MAX_CLAIMS) continue;
      claimKeys.add(key);
      claims.push({ ...claim, id: `repo-suggested-${claims.length + 1}`, source: path });
    }
    return content;
  }

  // Read root README first to discover author-curated links before ranking other files.
  if (rootReadme) {
    const content = await processFile(rootReadme);
    if (content) {
      for (const linked of markdownLinks(content, rootReadme)) {
        if (files.has(linked.toLowerCase())) linkedFromRoot.add(linked.toLowerCase());
      }
    }
  }

  // Rank all candidate documents, not just the alphabetically first twelve.
  // Translations are considered only if higher-value documents do not fill the budget.
  const candidates = [...files.values()]
    .filter((path) => !seen.has(path.toLowerCase()))
    .filter((path) => README.test(path) || TOPIC.test(path) || linkedFromRoot.has(path.toLowerCase()) || /^(docs|documentation)\//i.test(path))
    .sort((a, b) =>
      rankDocument(b, linkedFromRoot.has(b.toLowerCase())) - rankDocument(a, linkedFromRoot.has(a.toLowerCase()))
      || a.localeCompare(b)
    );

  for (const path of candidates) {
    if (documents.length >= MAX_DOCUMENTS || attempts >= MAX_FETCH_ATTEMPTS) break;
    await processFile(path);
  }

  return {
    repository: metadata.fullName,
    documents,
    claims,
    totalClaims: claims.length,
    explanation: `Offline suggestions from ${documents.length} repository Markdown documents. Review each claim before verification; documentation is not implementation evidence.`,
  };
}
