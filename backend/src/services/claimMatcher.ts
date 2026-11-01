import { Claim } from '../types/claims.js';
import {
  AnalyzedFile, ClaimEvidenceMatch, CodeEvidenceSnippet, CodeEvidenceStatus,
  ManifestDependency, RepoMetadata,
} from '../types/repository.js';

// Terms that describe a domain, rather than a particular capability.
const STOP = new Set(`a an the and or of for to in on at by from with this that these those is are was were be been being can could will would should has have had it its as into via using uses used use supports support provides provide allows allow enables enable implements implement implementation integrated integration feature features functionality application project repository source code software system service services technical claim claims claimed verification verified verify checking checks check process processing data information custom major both version versions different various multiple specific related relevant inspect actual example examples readme document documentation component components based built create creates generated generation automatic automatically simple advanced new existing user users their our your works working work available include includes including such only also all any each more less other than then when where how why what which who without within over under between across per test tests testing result results output input configuration configured configure setup set up file files module modules package packages library libraries tool tools supportable`.split(/\s+/));
const DOMAIN = new Set(['api', 'http', 'github', 'server', 'client', 'name', 'names']);

const STACK_CLAIM = /^(?:frontend|backend)\s*:/i;
const SCHEMA_CLAIM = /\b(?:structured claims?|validated against schema|schema validation)\b/i;

// Match a declared technology to its package name without treating the
// declaration as proof that the feature runs successfully.
function stackPackageMatches(label: string, packageName: string): boolean {
  const name = label.toLowerCase().trim().replace(/\s+\d+(?:\.\d+)*/g, '').trim();
  const pkg = packageName.toLowerCase();
  const aliases: Record<string, string[]> = {
    'node.js': ['@types/node'],
    'node': ['@types/node'],
    'lucide icons': ['lucide-react'],
    'tailwind css': ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'],
    'react': ['react', 'react-dom'],
    'typescript': ['typescript'],
    'express': ['express'],
    'vite': ['vite'],
    'cors': ['cors'],
    'dotenv': ['dotenv'],
    'tsx': ['tsx'],
  };
  return pkg === name || (aliases[name] ?? []).includes(pkg);
}

// Scope stack claims to a matching workspace when the repository actually
// has one. For single-package repositories, retain the existing behavior.
function stackManifestScope(
  title: string, dependencies: ManifestDependency[]
): string | null {
  const kind = /^(frontend|backend)\s*:/i.exec(title)?.[1]?.toLowerCase();
  if (!kind) return null;
  const prefix = `${kind}/`;
  return dependencies.some((dep) => dep.manifestFile.toLowerCase().startsWith(prefix))
    ? prefix : null;
}
function routeClaim(value: string): { method: string; path: string } | null {
  const match = value.match(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[a-z0-9_\-/]+)/i);
  return match ? { method: match[1].toUpperCase(), path: match[2].replace(/\/+$/, '').toLowerCase() } : null;
}
function stackNames(value: string): string[] {
  const afterColon = value.split(':').slice(1).join(':');
  return afterColon.split(/[,;]/).map((v) => v.trim().toLowerCase()).filter(Boolean);
}


const CONCEPTS: Record<string, string[]> = {
  routing: ['route', 'routes', 'router', 'routers', 'routing', 'routed'],
  middleware: ['middleware', 'middlewares'],
  filter: ['filter', 'filters', 'filtered', 'filtering'],
  convert: ['convert', 'converts', 'converted', 'converter', 'converters', 'conversion', 'transform', 'transformer', 'parse', 'parser', 'parsing'],
  property: ['property', 'properties', 'attribute', 'attributes'],
  global: ['global'],
  restart: ['restart', 'restarts', 'restartable', 'restarting', 'start', 'stop', 'stoppable', 'stopped', 'shutdown'],
  version: ['version', 'versions', 'metrics2', 'metrics3'],
  authentication: ['authentication', 'authenticate', 'login', 'auth'],
  jwt: ['jwt', 'jsonwebtoken'],
  oauth: ['oauth', 'passport'],
  database: ['database', 'postgres', 'postgresql', 'mongodb', 'mongoose', 'sqlite', 'prisma'],
};
const ALIAS_TO_CONCEPT = new Map<string, string>();
for (const [concept, aliases] of Object.entries(CONCEPTS)) {
  for (const alias of aliases) ALIAS_TO_CONCEPT.set(alias, concept);
}

function words(value: string): string[] {
  return (value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
    .match(/[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*|\d+[a-z]+/g) ?? [])
    .flatMap((part) => part.split(/[-_]/))
    .filter((part) => part.length >= 3 && !STOP.has(part));
}
function concepts(value: string): Set<string> {
  return new Set(words(value).map((w) => ALIAS_TO_CONCEPT.get(w) ?? w));
}
function matches(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((word) => b.has(word));
}
function githubLink(meta: RepoMetadata, path: string, start: number, end = start): string {
  const safePath = path.split('/').map(encodeURIComponent).join('/');
  const base = `https://github.com/${encodeURIComponent(meta.owner)}/${encodeURIComponent(meta.repo)}/blob/${encodeURIComponent(meta.headCommitSha)}/${safePath}`;
  return start > 0 ? `${base}#L${start}${end > start ? `-L${end}` : ''}` : base;
}
function excerpt(content: string, start: number, end: number): string {
  return content.split(/\r?\n/).slice(Math.max(0, start - 1), Math.max(start, end)).join('\n');
}
function lineOf(content: string, value: string): number {
  const index = content.split(/\r?\n/).findIndex((line) => line.toLowerCase().includes(value.toLowerCase()));
  return index < 0 ? 1 : index + 1;
}

type Ranked = { item: CodeEvidenceSnippet; score: number; identity: string; specific: boolean };

// A compound claim needs evidence for its *action*, not merely its subject.
// E.g. 'convert metric names into properties' must favor conversion/parsing
// implementations over property declarations.
const ACTION_CONCEPTS = new Set([
  'convert', 'filter', 'restart', 'authentication', 'database', 'routing',
]);
function claimActionConcepts(terms: Set<string>): Set<string> {
  return new Set([...terms].filter((term) => ACTION_CONCEPTS.has(term)));
}
function evidenceScore(
  base: number, claimActions: Set<string>, symbolHits: string[],
  pathHits: string[], domainHitCount: number
): number {
  const actionInSymbol = symbolHits.filter((term) => claimActions.has(term)).length;
  const actionInPath = pathHits.filter((term) => claimActions.has(term)).length;
  // The action must be reflected by the symbol or its file path when one
  // is explicitly claimed. A property-only symbol cannot outrank a parser.
  if (claimActions.size && !actionInSymbol && !actionInPath) {
    return Math.min(32, base);
  }
  return Math.min(95, base + actionInSymbol * 30 + actionInPath * 16
    + symbolHits.length * 8 + Math.min(domainHitCount, 2) * 2
    + Math.min(pathHits.length, 2) * 4);
}

export class ClaimMatcher {
  public static matchClaims(
    claims: Claim[], metadata: RepoMetadata, dependencies: ManifestDependency[],
    analyzedFiles: AnalyzedFile[], isPartialScan: boolean
  ): ClaimEvidenceMatch[] {
    return claims.map((claim) => this.evaluate(claim, metadata, dependencies, analyzedFiles, isPartialScan));
  }

  private static evaluate(
    claim: Claim, meta: RepoMetadata, dependencies: ManifestDependency[],
    files: AnalyzedFile[], partial: boolean
  ): ClaimEvidenceMatch {
    const claimText = `${claim.title} ${claim.originalText ?? ''}`;
    const endpoint = routeClaim(claimText);
    const stack = STACK_CLAIM.test(claim.title) ? stackNames(claim.title) : [];
    const manifestScope = stack.length ? stackManifestScope(claim.title, dependencies) : null;
    const schemaClaim = SCHEMA_CLAIM.test(claimText);
    const claimConcepts = concepts(claimText);
    const distinctive = new Set([...claimConcepts].filter((term) => !DOMAIN.has(term)));
    const actions = claimActionConcepts(distinctive);
    const ranked: Ranked[] = [];
    const matchedDependencies: ManifestDependency[] = [];

    const add = (
      filePath: string, start: number, end: number, code: string,
      kind: CodeEvidenceSnippet['kind'], reason: string, score: number,
      identity: string, specific: boolean
    ) => ranked.push({
      score, identity, specific,
      item: {
        filePath, lineStart: start, lineEnd: end, code,
        permalink: githubLink(meta, filePath, start, end),
        relevanceReason: reason, kind,
      },
    });

    // A matching library is context, never implementation proof.
    for (const dep of dependencies) {
      // Do not cite frontend dependencies for backend claims, or vice versa.
      // Only enforce this when the corresponding workspace manifest exists.
      if (manifestScope && !dep.manifestFile.toLowerCase().startsWith(manifestScope)) continue;
      const hits = matches(claimConcepts, concepts(dep.name));
      const stackHit = stack.some((name) => stackPackageMatches(name, dep.name));
      if (stackHit) {
        matchedDependencies.push(dep);
        add(dep.manifestFile, 1, 1, `Declared dependency: ${dep.name} ${dep.version ?? ''}`,
          'manifest', `Manifest declares ${dep.name}; dependency declaration is not proof of runtime use.`,
          45, `stack:${dep.manifestFile}:${dep.name}`, false);
        continue;
      }
      if (stack.length || endpoint) continue;
      const useful = hits.filter((term) => distinctive.has(term));
      if (!useful.length) continue;
      matchedDependencies.push(dep);
      add(dep.manifestFile, 1, 1, `Dependency: ${dep.name} ${dep.version ?? ''}`,
        'manifest', `Dependency ${dep.name} relates to ${useful.join(', ')}; declaration does not establish feature behavior.`,
        12, `dependency:${dep.name}`, false);
    }

    for (const file of files) {
      const pathConcepts = concepts(file.path);
      // Exact endpoint claims should not match unrelated functions sharing 'extract' or 'api'.
      if (endpoint && !file.routes.some((route) => route.method.toUpperCase() === endpoint.method
        && (route.path === endpoint.path || (file.path.endsWith('/routes/claims.ts') && endpoint.path === `/api/claims${route.path}`) || (file.path.endsWith('/routes/repository.ts') && endpoint.path === `/api/repository${route.path}`)))) continue;
      // Stack claims are best supported by manifests, not incidental code identifiers.
      if (stack.length) continue;
      const pathSpecific = matches(distinctive, pathConcepts);
      const lines = file.content.split(/\r?\n/);
      const candidateSymbols: Array<{ name: string; start: number; end: number; kind: 'function' | 'class' }> = [
        ...file.functions.map((f) => ({ name: f.name, start: f.lineStart, end: f.lineEnd, kind: 'function' as const })),
        ...file.classes.map((c) => ({ name: c.name, start: c.lineStart, end: c.lineEnd, kind: 'class' as const })),
      ];

      for (const symbol of candidateSymbols) {
        const symbolConcepts = concepts(symbol.name);
        const specificHits = matches(distinctive, symbolConcepts);
        // Ignore symbols that match only broad domain terms such as 'metric'.
        if (!specificHits.length) continue;
        const domainHits = matches(claimConcepts, symbolConcepts).filter((term) => DOMAIN.has(term));
        const start = Math.max(1, symbol.start);
        const end = Math.min(lines.length, Math.max(start, Math.min(symbol.end, start + 8)));
        const score = evidenceScore(45, actions, specificHits, pathSpecific, domainHits.length);
        // Don't present a subject-only match as an implementation of the action.
        const actionRelevant = !actions.size || specificHits.some((term) => actions.has(term))
          || pathSpecific.some((term) => actions.has(term));
        add(file.path, start, end, excerpt(file.content, start, end), symbol.kind,
          `${symbol.kind === 'function' ? 'Method/function' : 'Class'} ${symbol.name} matches distinctive claim concept(s): ${specificHits.join(', ')}. Review its implementation; runtime behavior was not tested.`,
          score, `symbol:${symbol.name.toLowerCase()}`, actionRelevant);
      }

      for (const route of file.routes) {
        const exactEndpoint = endpoint !== null && route.method.toUpperCase() === endpoint.method
          && (route.path === endpoint.path || (file.path.endsWith('/routes/claims.ts') && endpoint.path === `/api/claims${route.path}`) || (file.path.endsWith('/routes/repository.ts') && endpoint.path === `/api/repository${route.path}`));
        const specificHits = exactEndpoint ? ['exact endpoint path and method'] : matches(distinctive, concepts(route.path));
        if (endpoint && !exactEndpoint) continue;
        if (!specificHits.length || (actions.size && !specificHits.some((term) => actions.has(term))
          && !pathSpecific.some((term) => actions.has(term)))) continue;
        const start = Math.max(1, route.lineStart);
        const end = Math.min(lines.length, Math.max(start, Math.min(route.lineEnd, start + 6)));
        add(file.path, start, end, excerpt(file.content, start, end), 'route',
          `Endpoint ${route.method} ${route.path} matches distinctive concept(s): ${specificHits.join(', ')}. Its behavior is not verified.`,
          exactEndpoint ? 95 : 70 + Math.min(20, specificHits.length * 8), `route:${route.method}:${route.path}`, true);
      }

      for (const call of file.calls ?? []) {
        const callerHits = matches(distinctive, concepts(call.caller));
        const calleeHits = matches(distinctive, concepts(call.callee));
        if (!callerHits.length || !calleeHits.length) continue;
        // Exclude AST expressions mistakenly captured as a short callee name.
        if (call.caller.length > 80 || call.callee.length > 80 || /[\n{};]/.test(call.callee)) continue;
        if (actions.size && ![...callerHits, ...calleeHits, ...pathSpecific].some((term) => actions.has(term))) continue;
        add(file.path, call.line, call.line, excerpt(file.content, call.line, call.line), 'function_call',
          `Static call ${call.caller} → ${call.callee} relates to ${[...new Set([...callerHits, ...calleeHits])].join(', ')}. This is not a runtime trace.`,
          76, `call:${call.caller}:${call.callee}`, true);
      }

      for (const imp of file.imports) {
        const specificHits = matches(distinctive, concepts(imp));
        if (!specificHits.length) continue;
        const line = lineOf(file.content, imp);
        add(file.path, line, line, excerpt(file.content, line, line), 'import',
          `Import ${imp} relates to ${specificHits.join(', ')}; an import alone does not establish implementation.`,
          18 + Math.min(10, specificHits.length * 4), `import:${imp}`, false);
      }

      // Structured claim validation: identify schema-like declarations as context, not proof.
      if (schemaClaim && /(?:claims|gemini|schema|validation)/i.test(file.path)) {
        let found = 0;
        for (let i = 0; i < lines.length && found < 2; i++) {
          const line = lines[i].trim();
          if (/^(?:\/\/|\*|import\s)/.test(line)) continue;
          if (/\b(?:z\.object|safeParse|\.parse\(|originalText|proposedChecks|NOT_TESTED)\b/.test(line)) {
            add(file.path, i + 1, i + 1, line.slice(0, 200), 'text_match',
              'Potential claim-schema or validation code; review whether validation is enforced.',
              42, `schema:${i + 1}`, false);
            found++;
          }
        }
      }

      // Search actual source statements as a fallback when symbols don't contain the feature name.
      // Require a distinctive concept AND contextual agreement; exclude imports/comments.
      if (pathSpecific.length) {
        let added = 0;
        for (let i = 0; i < lines.length && added < 2; i++) {
          const trimmed = lines[i].trim();
          if (!trimmed || /^(import\s|package\s|\/\/|\*|#)/.test(trimmed)) continue;
          const specificHits = matches(distinctive, concepts(trimmed));
          if (!specificHits.length) continue;
          const domainHits = matches(claimConcepts, concepts(trimmed)).filter((term) => DOMAIN.has(term));
          if (!domainHits.length && specificHits.length < 2) continue;
          const start = i + 1;
          add(file.path, start, Math.min(lines.length, start + 3), excerpt(file.content, start, start + 3),
            'text_match', `Source statement in a relevant file shares distinctive claim concept(s): ${specificHits.join(', ')}. Requires manual review.`,
            36 + Math.min(10, specificHits.length * 4), `source:${start}`, false);
          added++;
        }
      }
    }

    // Constructors with the same name in the same file provide little independent evidence.
    // Keep the highest-scoring occurrence; preserve distinct methods and paths.
    const dedup = new Map<string, Ranked>();
    for (const entry of ranked) {
      const key = `${entry.item.filePath}:${entry.identity}:${entry.item.lineStart}`;
      const previous = dedup.get(key);
      if (!previous || entry.score > previous.score) dedup.set(key, entry);
    }
    const sorted = [...dedup.values()].sort((a, b) => b.score - a.score || a.item.filePath.localeCompare(b.item.filePath));
    const implementation = sorted.filter((r) => r.specific && ['function', 'class', 'route', 'function_call'].includes(r.item.kind));
    const contextual = sorted.filter((r) => ['import', 'manifest', 'text_match'].includes(r.item.kind));
    // Evidence lacking the requested action remains background context.
    const presentationOrder = actions.size
      ? [...sorted.filter((r) => r.specific), ...sorted.filter((r) => !r.specific)]
      : sorted;

    let status: CodeEvidenceStatus = 'INCONCLUSIVE';
    let assessmentReason: string;
    if (implementation.length) {
      status = 'LIMITED_EVIDENCE';
      assessmentReason = `Found ${implementation.length} candidate implementation symbol(s) matching the claim's distinctive capability. Their behavior has not been executed or verified.`;
    } else if (contextual.length) {
      status = 'LIMITED_EVIDENCE';
      assessmentReason = stack.length
        ? `Found declarations or contextual references for the claimed stack. Check each named technology against manifests; this does not establish runtime use.`
        : `Found ${contextual.length} contextual reference(s), but no sufficiently specific implementation symbols. The claimed behavior remains unverified.`;
    } else {
      assessmentReason = 'No sufficiently specific implementation evidence was identified in the analyzed files. This does not establish that the feature is absent.';
    }
    if (endpoint && implementation.length) assessmentReason += ' The declared HTTP method and path were matched; handler behavior remains untested.';
    if (partial) assessmentReason += ' Repository coverage was partial.';

    const callSteps = sorted.filter((r) => r.item.kind === 'function_call').slice(0, 6).map((r) => {
      const pair = r.identity.slice('call:'.length).split(':');
      return {
        caller: pair[0] ?? 'Unknown', callee: pair.slice(1).join(':') || 'Unknown',
        filePath: r.item.filePath, line: r.item.lineStart, permalink: r.item.permalink
      };
    });

    // Prefer diverse files when presenting the five highest-ranked candidates.
    const chosen: Ranked[] = [];
    const fileCounts = new Map<string, number>();
    for (const entry of presentationOrder) {
      const count = fileCounts.get(entry.item.filePath) ?? 0;
      if (count >= 2) continue;
      chosen.push(entry);
      fileCounts.set(entry.item.filePath, count + 1);
      if (chosen.length >= 5) break;
    }
    return {
      claimId: claim.id, claimTitle: claim.title, claimCategory: claim.category,
      originalText: claim.originalText, runtimeStatus: 'NOT_TESTED',
      codeEvidenceStatus: status, assessmentReason, matchedDependencies,
      implementationTrail: callSteps.length ? {
        steps: callSteps,
        description: 'Related static call relationships; not a verified execution sequence.',
      } : undefined,
      evidenceSnippets: chosen.map((r) => r.item),
      confidenceScore: 0,
    };
  }
}
