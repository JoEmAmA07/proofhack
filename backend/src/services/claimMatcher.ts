import { Claim } from '../types/claims.js';
import {
  AnalyzedFile,
  ClaimEvidenceMatch,
  CodeEvidenceSnippet,
  CodeEvidenceStatus,
  ManifestDependency,
  RepoMetadata,
} from '../types/repository.js';

export class ClaimMatcher {
  /**
   * Evaluates a collection of technical claims against the analyzed repository files and dependencies.
   */
  public static matchClaims(
    claims: Claim[],
    metadata: RepoMetadata,
    dependencies: ManifestDependency[],
    analyzedFiles: AnalyzedFile[],
    isPartialScan: boolean
  ): ClaimEvidenceMatch[] {
    return claims.map((claim) =>
      this.evaluateClaim(claim, metadata, dependencies, analyzedFiles, isPartialScan)
    );
  }

  /**
   * Evaluates a single claim against manifests and analyzed source files.
   */
  private static evaluateClaim(
    claim: Claim,
    metadata: RepoMetadata,
    dependencies: ManifestDependency[],
    analyzedFiles: AnalyzedFile[],
    isPartialScan: boolean
  ): ClaimEvidenceMatch {
    const claimKeywords = this.extractKeywords(claim);
    const matchedDeps: ManifestDependency[] = [];
    const snippets: CodeEvidenceSnippet[] = [];

    // 1. Check dependencies declared in manifests
    for (const dep of dependencies) {
      const depNameLower = dep.name.toLowerCase();
      for (const kw of claimKeywords) {
        if (depNameLower.includes(kw) || kw.includes(depNameLower)) {
          if (!matchedDeps.some((d) => d.name === dep.name)) {
            matchedDeps.push(dep);
            snippets.push({
              filePath: dep.manifestFile,
              lineStart: 1,
              lineEnd: 1,
              code: `"${dep.name}": "${dep.version || '*'}"`,
              permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${dep.manifestFile}`,
              relevanceReason: `Dependency "${dep.name}" declared in ${dep.manifestFile} matches claimed capability.`,
              kind: 'manifest',
            });
          }
        }
      }
    }

    // 2. Scan AST symbols and source code in analyzed files
    for (const file of analyzedFiles) {
      const fileLower = file.path.toLowerCase();

      // Check imports
      for (const imp of file.imports) {
        const impLower = imp.toLowerCase();
        for (const kw of claimKeywords) {
          if (impLower.includes(kw) || kw.includes(impLower)) {
            const line = this.findLineInContent(file.content, imp);
            snippets.push({
              filePath: file.path,
              lineStart: line,
              lineEnd: line,
              code: this.getSnippetLines(file.content, line, line),
              permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${file.path}#L${line}`,
              relevanceReason: `Source file imports module "${imp}" directly relevant to claim.`,
              kind: 'import',
            });
          }
        }
      }

      // Check function definitions
      for (const fn of file.functions) {
        const fnLower = fn.name.toLowerCase();
        for (const kw of claimKeywords) {
          if (this.matchesIdentifier(fn.name, kw)) {
            snippets.push({
              filePath: file.path,
              lineStart: fn.lineStart,
              lineEnd: fn.lineEnd,
              code: this.getSnippetLines(file.content, fn.lineStart, Math.min(fn.lineEnd, fn.lineStart + 6)),
              permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${file.path}#L${fn.lineStart}-L${fn.lineEnd}`,
              relevanceReason: `Candidate function "${fn.name}()" has a name matching "${kw}". Its behavior has not been verified.`,
              kind: 'function',
            });
          }
        }
      }

      // Check routes
      for (const route of file.routes) {
        const routeLower = `${route.method} ${route.path}`.toLowerCase();
        for (const kw of claimKeywords) {
          if (routeLower.includes(kw)) {
            snippets.push({
              filePath: file.path,
              lineStart: route.lineStart,
              lineEnd: route.lineEnd,
              code: this.getSnippetLines(file.content, route.lineStart, route.lineEnd),
              permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${file.path}#L${route.lineStart}-L${route.lineEnd}`,
              relevanceReason: `Candidate route "${route.method} ${route.path}" matches claim terminology. Its behavior has not been verified.`,
              kind: 'route',
            });
          }
        }
      }

      // Check static function-call relationships.
      // A matching call is supporting evidence, NOT proof of working behavior.
      for (const call of file.calls ?? []) {
        const callerMatches = claimKeywords.some((kw) =>
          this.matchesIdentifier(call.caller, kw)
        );

        const calleeMatches = claimKeywords.some((kw) =>
          this.matchesIdentifier(call.callee, kw)
        );

        if (!callerMatches && !calleeMatches) {
          continue;
        }

        snippets.push({
          filePath: file.path,
          lineStart: call.line,
          lineEnd: call.line,
          code: this.getSnippetLines(file.content, call.line, call.line),
          permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${file.path}#L${call.line}`,
          relevanceReason:
            `Static call relationship: "${call.caller}" calls "${call.callee}". ` +
            `This may relate to the claim, but execution and behavior have not been verified.`,
          kind: 'function_call',
        });
      }

      // Check file path and keywords in content if no snippet found for this file yet
      const pathMatchesKeyword = claimKeywords.some((kw) => fileLower.includes(kw));
      if (pathMatchesKeyword && !snippets.some((s) => s.filePath === file.path)) {
        // Find best matching line in file
        const matchingLine = this.findBestMatchingLine(file.content, claimKeywords);
        if (matchingLine > 0) {
          snippets.push({
            filePath: file.path,
            lineStart: Math.max(1, matchingLine - 1),
            lineEnd: matchingLine + 3,
            code: this.getSnippetLines(file.content, Math.max(1, matchingLine - 1), matchingLine + 3),
            permalink: `https://github.com/${metadata.owner}/${metadata.repo}/blob/${metadata.headCommitSha}/${file.path}#L${matchingLine}`,
            relevanceReason: `Source file structure and logic align with claimed feature.`,
            kind: 'text_match',
          });
        }
      }
    }

    // Deduplicate snippets by filePath and lineStart

    const uniqueSnippets = snippets.filter(
      (snip, idx, self) =>
        idx === self.findIndex(
          (s) =>
            s.filePath === snip.filePath &&
            s.lineStart === snip.lineStart &&
            s.kind === snip.kind &&
            s.relevanceReason === snip.relevanceReason
        )
    );


    // 3. Determine Code Evidence Status

    // 3. Conservative evidence assessment.
    // Static keyword and symbol matches identify candidates,
    // NOT verified implementations or working features.

    let status: CodeEvidenceStatus = 'INCONCLUSIVE';
    let assessmentReason = '';
    const confidenceScore = 0;

    const candidateSnippets = uniqueSnippets.filter(
      (s) =>
        s.kind === 'function' ||
        s.kind === 'route' ||
        s.kind === 'class'
    );

    const importSnippets = uniqueSnippets.filter(
      (s) => s.kind === 'import'
    );

    if (candidateSnippets.length > 0) {
      status = 'LIMITED_EVIDENCE';
      assessmentReason =
        `Found ${candidateSnippets.length} candidate function/route ` +
        `symbol match(es). Their names or paths may relate to the claim, ` +
        `but implementation behavior has not been established. ` +
        `Runtime testing has not been performed.` +
        (isPartialScan ? ' Repository coverage is partial.' : '');
    } else if (importSnippets.length > 0 || matchedDeps.length > 0) {
      status = 'LIMITED_EVIDENCE';
      assessmentReason =
        'Related imports or declared dependencies were detected. ' +
        'These do not establish that the claimed feature is implemented. ' +
        'No relevant implementation behavior was verified.' +
        (isPartialScan ? ' Repository coverage is partial.' : '');
    } else {
      status = 'INCONCLUSIVE';
      assessmentReason =
        'Insufficient evidence to assess this claim. ' +
        'No verified implementation behavior was identified. ' +
        (isPartialScan
          ? 'Only part of the repository was analyzed.'
          : 'No matching candidates were identified in the scanned files.');
    }

    return {
      claimId: claim.id,
      claimTitle: claim.title,
      claimCategory: claim.category,
      originalText: claim.originalText,
      runtimeStatus: 'NOT_TESTED' as const, // Strictly NOT_TESTED: code evidence != runtime proof
      codeEvidenceStatus: status,
      assessmentReason,
      matchedDependencies: matchedDeps,
      evidenceSnippets: [...uniqueSnippets]
        .sort((a, b) => {
          const priority: Record<string, number> = {
            route: 6,
            function: 5,
            class: 5,
            function_call: 4,
            text_match: 2,
            import: 1,
            manifest: 0,
          };

          return (priority[b.kind] ?? 0) - (priority[a.kind] ?? 0);
        })
        .slice(0, 5),
      confidenceScore,
    };
  }

  /**
   * Extracts searchable domain keywords from a claim.
   */
  private static extractKeywords(claim: Claim): string[] {
    const rawTokens = [
      claim.title,
      claim.category,
      ...(claim.proposedChecks || []),
    ].join(' ').toLowerCase();

    // Map common domain terms to related tech identifiers
    const keywords = new Set<string>();
    const claimWords = new Set(
      rawTokens
        .replace(/[^a-z0-9_-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    );

    const DOMAIN_MAP: Record<string, string[]> = {
      jwt: ['jwt', 'jsonwebtoken', 'bearer', 'token'],
      oauth: ['oauth', 'passport', 'google', 'github', 'auth0', 'auth'],
      bcrypt: ['bcrypt', 'hash', 'salt', 'password'],
      authentication: ['auth', 'login', 'token', 'session', 'passport'],
      security: ['auth', 'crypto', 'cors', 'helmet', 'security'],
      prisma: ['prisma', '@prisma/client', 'schema.prisma'],
      postgres: ['pg', 'postgres', 'postgresql', 'prisma'],
      database: ['db', 'database', 'sql', 'query', 'model', 'schema'],
      sqlite: ['sqlite', 'sqlite3', 'better-sqlite3'],
      mongodb: ['mongo', 'mongodb', 'mongoose'],
      redis: ['redis', 'ioredis', 'cache'],
      playwright: ['playwright', '@playwright/test', 'e2e'],
      docker: ['docker', 'dockerfile', 'container'],
      api: ['api', 'route', 'endpoint', 'router', 'express', 'rest'],
      rest: ['api', 'route', 'get', 'post', 'router'],
      gemini: ['@google/genai', '@google/generative-ai', 'gemini'],
      ai: ['ai', 'llm', 'genai', 'openai', 'model'],
      stripe: ['stripe', 'payment', 'webhook', 'billing'],
    };

    for (const [key, aliases] of Object.entries(DOMAIN_MAP)) {
      if (claimWords.has(key)) {
        aliases.forEach((a) => keywords.add(a));
      }
    }

    // Add clean word tokens (min length 4)
    rawTokens
      .replace(/[^a-z0-9_-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !['with', 'from', 'uses', 'test', 'this', 'that', 'have'].includes(w))
      .forEach((w) => keywords.add(w));

    return Array.from(keywords);
  }
  private static matchesIdentifier(identifier: string, keyword: string): boolean {
    const words = identifier
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return words.includes(keyword.toLowerCase());
  }


  private static findLineInContent(content: string, substring: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(substring)) {
        return i + 1;
      }
    }
    return 1;
  }

  private static findBestMatchingLine(content: string, keywords: string[]): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (keywords.some((kw) => lineLower.includes(kw))) {
        return i + 1;
      }
    }
    return -1;
  }

  private static getSnippetLines(content: string, startLine: number, endLine: number): string {
    const lines = content.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, Math.max(startLine, endLine));
    return lines.slice(start, end).join('\n');
  }
}
