export interface SuggestedClaim {
    id: string;
    title: string;
    originalText: string;
    category: string;
    source: string;
    proposedChecks: string[];
    status: 'NOT_TESTED';
}

const MAX_CLAIMS = 20;
const TECH = /\b(?:metrics?|metricregistry|reporters?|registr(?:y|ies)|properties|conversion|convert|custom|global|stoppable|restartable|api|claim|claims|verdict|verdicts|documentation|metadata|manifest|static|endpoint|route|router|http|graphql|grpc|websocket|webhook|auth|oauth|jwt|session|cookie|cache|caching|database|postgres|mysql|sqlite|mongo|redis|storage|validation|schema|typescript|javascript|react|vue|angular|express|vite|next\.?js|node\.?js|python|django|flask|fastapi|java|spring|go|rust|docker|kubernetes|cloud|aws|firebase|supabase|tailwind|component|hook|state|middleware|logging|monitoring|test|ci|cd|deploy|security|encrypt|parse|parser|pdf|pptx|markdown|upload|file|github|repository|source|dependency|dependencies|configuration|cli|request|response|stream|render|plugin|integration|lint|build|report|export|import|analy[sz]|verify|verification|evidence|extract|generate|fetch|search|filter|pagination|routing|forms?|authentication|authorization|notifications?|email|payment|queue|worker|socket|real.time|dashboard|typescript|jsx|tsx|json|yaml|openapi|swagger|rest)\b/i;
const ACTION = /\b(?:uses?|implements?|integrates?|supports?|provides?|includes?|contains?|exposes?|registers?|defines?|configures?|handles?|processes?|parses?|extracts?|generates?|validates?|verifies?|analy[sz]es?|monitors?|tracks?|filters?|converts?|exports?|imports?|stores?|sends?|receives?|authenticates?|encrypts?|detects?|collects?|reports?|maps?|connects?|persists?|renders?|fetches?|caches?|loads?|deploys?|builds?|tests?|organizes?|separates?|manages?|calls?|runs?|executes?|offers?|allows?|enables?|automates?|serves?|creates?|accepts?|returns?|scans?|discovers?|distinguishes?|classifies?|displays?|shows?|retrieves?|reads?|writes?|uploads?|downloads?|matches?|compares?|preserves?|lists?|paginates?|provides?)\b/i;
const NEGATION = /\b(?:does\s+not|doesn't|do\s+not|don't|cannot|can't|will\s+not|won't|is\s+not|are\s+not|not\s+yet|not\s+implemented|not\s+supported|without\s+(?:implementing|running|executing)|no\s+(?:support|implementation))\b/i;
const ADVICE = /\b(?:should|could|would|might|recommended|recommend|consider|ideally|preferably|best practice|you can|you should|you need|if you|when you|for example|for instance|e\.g\.|try to|supposed to|aims? to|attempts? to|goal is|rather than|instead of|please|feel free|planned|coming soon|roadmap|hypothetical|illustrative|in this example|in this tutorial|let's|we will|you will|you'll|imagine|suppose|it's important to|it is important to)\b/i;
const FUTURE = /\b(?:roadmap|future|planned|upcoming|todo|backlog|next steps|in progress|not implemented|coming soon|phase [3-9])\b/i;
const EXCLUDE_HEADING = /\b(?:installation|getting started|quickstart|setup|usage|how to|tutorial|examples?|contributing|license|faq|troubleshooting|migration|best practices|recommendations|principles|philosophy|guidelines|reference|resources|table of contents|limitations|disclaimer|future|roadmap|planned|prerequisites|requirements|deployment guide)\b/i;
const FEATURE_HEADING = /\b(?:features?|capabilities|functionality|highlights|what .+ does|what .+ offers|overview|architecture|modules?|components?|implementation|technology stack|tech stack|api|endpoints?|parsing|analysis|verification|how it works|core|built with|stack|workflow|integrations?|security|authentication|state management|performance|testing)\b/i;
const IMPERATIVE = /^(?:create|add|make|write|define|implement|configure|install|set up|setup|use|store|keep|put|wrap|build|run|execute|fetch|call|send|return|handle|ensure|avoid|prefer|choose|follow|check|test|try|consider|extract|generate|validate|verify|connect|import|export|update|remove|enable|disable)\b/i;

function normalize(raw: string): string {
    return raw.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
        .replace(/^\s*#{1,6}\s*/, '')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();
}
function classify(text: string): string {
    if (/\b(auth|oauth|jwt|login|password|security|encrypt|sessions?)\b/i.test(text)) return 'Security & Authentication';
    if (/\b(database|sql|postgres|mongo|redis|storage|persist|cache)\b/i.test(text)) return 'Data & Storage';
    if (/\b(api|endpoint|webhook|http|routing|router|middleware|request|response|openapi)\b/i.test(text)) return 'API & Integration';
    if (/\b(test|verify|validate|check|ci\/cd)\b/i.test(text)) return 'Testing & Verification';
    if (/\b(report|export|pdf|dashboard|visualiz)\b/i.test(text)) return 'Reporting';
    if (/\b(metric|monitor|filter|telemetry)\b/i.test(text)) return 'Metrics & Monitoring';
    if (/\b(ai|llm|gemini|openai)\b/i.test(text)) return 'Artificial Intelligence';
    return 'Technical Feature';
}
function titleOf(line: string): string {
    if (line.length <= 105) return line.replace(/[.;:]+$/, '');
    const cut = line.slice(0, 105);
    return cut.slice(0, Math.max(55, cut.lastIndexOf(' '))).replace(/[.;:]+$/, '');
}
function splitPages(text: string): Array<{ source: string; content: string }> {
    const marks = [...text.matchAll(/\[(Slide|Page)\s+(\d+)\]/gi)];
    if (!marks.length) return [{ source: 'Document', content: text }];
    return marks.map((m, i) => ({
        source: `${m[1].toLowerCase() === 'page' ? 'Page' : 'Slide'} ${m[2]}`,
        content: text.slice((m.index ?? 0) + m[0].length, i + 1 < marks.length ? marks[i + 1].index : text.length),
    }));
}

function slideCandidates(content: string): string[] {
    const clean = content.replace(/\s+/g, ' ').trim();
    const result: string[] = [];
    // Numbered points often survive PPTX extraction even when newlines do not.
    const numbered = /(?:^|\s)(?:\d{1,2}[.)]\s+)(?=[A-Z])/g;
    const positions = [...clean.matchAll(numbered)].map(m => (m.index ?? 0) + (m[0].startsWith(' ') ? 1 : 0));
    for (let i = 0; i < positions.length; i++) {
        const fragment = clean.slice(positions[i], positions[i + 1] ?? clean.length)
            .replace(/^\d{1,2}[.)]\s+/, '');
        const sentence = fragment.split(/(?<=[.!?])\s+(?=[A-Z])/)[0]?.trim();
        if (sentence) result.push(sentence);
    }
    // Explicit product statements and independent action phrases in prose.
    const actionPhrase = /\b(?:extract|locate|identify|analy[sz]e|generate|verify|map|link|parse|capture|report|inspect|compare|validate|organize|collect|produce|create|support|provide|detect|store|export|import|scan|check|run|execute|suggest|define|turns?|links?|defines?|runs?|organizes?|extracts?|locates?|generates?|verifies?|maps?|parses?|captures?|reports?|analy[sz]es?|provides?|supports?|detects?|stores?|exports?|imports?|scans?|checks?|suggests?)\b[^.!?]{12,140}[.!?]/gi;
    for (const match of clean.matchAll(actionPhrase)) {
        const phrase = match[0].trim();
        if (phrase) result.push(phrase);
    }
    // Split short descriptions after headings/labels and before the next known
    // slide section, while avoiding an entire slide as a single candidate.
    const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length >= 20 && trimmed.length <= 180) result.push(trimmed);
    }
    return [...new Set(result.map(p => p.replace(/\s+/g, ' ').trim()))]
        .filter(p => p.length >= 18 && p.length <= 200);
}

/** Context helps rank claims, but it never proves implementation. */
function slideContextScore(content: string): number {
    if (/\b(?:worked example|illustrative scenario|proposed technology stack|roadmap|future work|mvp plan|phase 0[1-9])\b/i.test(content)) return -3;
    if (/\b(?:what .* does|core modules|solution|features|capabilities)\b/i.test(content)) return 2;
    return 0;
}



interface Candidate { text: string; source: string; score: number; }

function markdownCandidates(content: string): Candidate[] {
    const result: Candidate[] = [];
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    // Track heading ancestry: a nested "Usage" heading must not erase a parent
    // "Features" context, and a nested "Future" heading must be excluded.
    const headings: Array<{ level: number; title: string }> = [];
    let inFence = false;
    let inHtmlComment = false;

    function headingContext(): { title: string; feature: boolean; excluded: boolean } {
        const titles = headings.map(h => h.title);
        const excluded = titles.some(t => EXCLUDE_HEADING.test(t) || FUTURE.test(t));
        const feature = !excluded && titles.some(t => FEATURE_HEADING.test(t));
        return { title: titles[titles.length - 1] || 'Document', feature, excluded };
    }

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        let trimmed = raw.trim();
        if (trimmed.includes('<!--')) inHtmlComment = true;
        if (inHtmlComment) {
            if (trimmed.includes('-->')) inHtmlComment = false;
            continue;
        }
        if (/^(```|~~~)/.test(trimmed)) { inFence = !inFence; continue; }
        if (inFence || !trimmed || /^>|^\s*<|^\s*\|/.test(trimmed)) continue;

        // Markdown supports both '# Features' and Setext 'Features\n========'.
        const atx = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(trimmed);
        const setext = i + 1 < lines.length && /^\s*(={3,}|-{3,})\s*$/.exec(lines[i + 1]);
        if (atx || (setext && !/^[-*+]\s/.test(trimmed))) {
            const level = atx
                ? (trimmed.match(/^#+/)?.[0].length || 1)
                : (setext && setext[1]?.[0] === '=' ? 1 : 2);
            const title = normalize(atx ? atx[1] : trimmed);
            while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
            headings.push({ level, title });
            if (!atx) i++;
            continue;
        }
        if (/^(?:={3,}|-{3,})$/.test(trimmed)) continue;

        const ctx = headingContext();
        if (ctx.excluded || /^\s*[-*+]\s+\[ \]/.test(raw)) continue;
        const bullet = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(raw);
        const boldLabel = /^\s*[-*+]?\s*\*\*[^*]{3,90}\*\*\s*(?::|[-–—]|\s)/.test(raw);
        const line = normalize(raw);
        if (line.length < 12 || line.length > 420) continue;
        if (/^(?:https?:|www\.|npm |yarn |pnpm |pip |git |curl |docker |import |export |const |let |var |#include|\$ )/i.test(line)) continue;
        if (NEGATION.test(line) || ADVICE.test(line) || FUTURE.test(line)) continue;
        if (/\b(?:best|most secure|better|recommended|ideal)\s+(?:practice|approach|pattern|way|option)\b/i.test(line)) continue;
        if (IMPERATIVE.test(line) || /^(?:a|an)\s+[^.!?]{3,110}\s+that\s+(?:calls?|uses?|handles?|wraps?|fetches?|returns?)\b/i.test(line)) continue;
        if (/^(?:note|tip|warning|important|example|step)\s*:/i.test(line) || /[?]/.test(line)) continue;
        if (/\b(?:you|your|developers?)\b/i.test(line)) continue;

        // A capability must be anchored in technical content. Heading context
        // can supply that anchor for noun phrases such as "Custom filters".
        const technical = TECH.test(line) || (ctx.feature && /\b(?:filters?|reporters?|properties|versions?|formats?|plugins?|providers?|drivers?|adapters?|connectors?)\b/i.test(line));
        if (!technical) continue;
        const subject = /\b(?:this|our|the)\s+(?:project|repo(?:sitory)?|application|app|package|library|tool|system|service|backend|frontend|api|client|platform)\b|\bwe\s+(?:use|provide|support|implement|include|expose|build)\b/i.test(line);
        const assertion = /\b(?:is|are|has been|have been)\s+(?:already\s+|currently\s+|automatically\s+)?(?:implemented|integrated|configured|included|installed|enabled|supported|provided|defined|registered|deployed|built|used|powered|stoppable|restartable|configurable)\b/i.test(line);
        const explicit = subject && ACTION.test(line);
        const concreteProse = ACTION.test(line) && /\b(?:app|project|platform|service|server|backend|frontend|system|library|package|framework|tool|repository|bridge|reporter|plugin|client|api)\b.{0,90}\b(?:uses?|supports?|provides?|implements?|exposes?|includes?|handles?|generates?|extracts?|parses?|integrates?|offers?|contains?|converts?|filters?|sends?|reports?)\b/i.test(line);
        // Real READMEs often use short, verbless feature bullets and setext
        // headings. Accept them in feature sections, not in general prose.
        const capabilityBullet = ctx.feature && bullet && line.length <= 260 && (
            ACTION.test(line) || assertion || boldLabel ||
            /\b(?:with|via|using|powered by|built on|for|into|to|of|and|or)\b/i.test(line) ||
            /^(?:support|conversion|integration|authentication|authorization|generation|reporting|filtering|monitoring|custom|global|automatic|automated|stoppable|restartable|configurable|multiple|multi[- ])\b/i.test(line) ||
            line.split(/\s+/).length <= 9
        );
        // Some READMEs use one feature per plain line beneath Features.
        const shortFeatureLine = ctx.feature && !bullet && !/^\s/.test(raw) &&
            line.length <= 110 && line.split(/\s+/).length <= 12 &&
            /^(?:support(?:s|ed)?\s+for|conversion\s+of|integration\s+with|custom\s+|global\s+|automatic\s+|built.in\s+|reporters?\s+(?:are|is)|[A-Za-z][\w-]+\s+(?:support|integration|reporting))\b/i.test(line);
        if (!explicit && !assertion && !concreteProse && !capabilityBullet && !shortFeatureLine) continue;
        let score = 2 + (ctx.feature ? 3 : 0) + (bullet ? 1 : 0) + (boldLabel ? 2 : 0) + (explicit ? 3 : 0) + (assertion ? 2 : 0) + (concreteProse ? 2 : 0);
        if (/\b(?:blazing|revolutionary|beautiful|amazing|powerful|robust|scalable)\b/i.test(line)) score -= 2;
        if (score < 4) continue;
        result.push({ text: line, source: `Section: ${ctx.title}`, score });
    }
    return result;
}

/** Offline suggestions are candidates for review, never verified facts. */
export function suggestClaimsFromText(text: string): SuggestedClaim[] {
    const sections = splitPages(text);
    const candidates: Candidate[] = [];
    for (const section of sections) {
        if (section.source === 'Document') {
            candidates.push(...markdownCandidates(section.content));
            continue;
        }
        // Keep the existing slide/page extraction path independent of Markdown heuristics.
        const slideLines = [...section.content.split(/\r?\n/), ...slideCandidates(section.content)];
        for (const raw of slideLines) {
            const line = normalize(raw);
            if (line.length < 18 || line.length > 320 || NEGATION.test(line) || ADVICE.test(line)) continue;
            if (!TECH.test(line) || !ACTION.test(line) || /^(?:note|example|warning)\s*:/i.test(line)) continue;
            const score = 5 + slideContextScore(section.content) + (ACTION.test(line) ? 1 : 0);
            if (score < 4) continue;
            candidates.push({ text: line, source: `${section.source} (proposal; implementation unverified)`, score });
        }
    }
    const seen = new Set<string>();
    const ranked = candidates.sort((a, b) => b.score - a.score);
    const output: SuggestedClaim[] = [];
    for (const candidate of ranked) {
        const key = candidate.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 180);
        if (seen.has(key) || key.length < 12) continue;
        seen.add(key);
        const title = titleOf(candidate.text);
        output.push({
            id: `suggested-${output.length + 1}`,
            title,
            originalText: candidate.text.slice(0, 400),
            category: classify(candidate.text),
            source: candidate.source,
            proposedChecks: [
                `Locate source code or configuration supporting: ${title}`,
                'Inspect implementation and dependencies for corroborating evidence',
                'Static code evidence does not prove runtime behavior',
            ],
            status: 'NOT_TESTED',
        });
        if (output.length >= MAX_CLAIMS) break;
    }
    return output;
}
