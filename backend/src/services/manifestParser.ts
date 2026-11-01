import { ManifestDependency } from '../types/repository.js';

/**
 * Best-effort static extraction of DECLARED dependencies.
 * This does not resolve lockfiles, transitive dependencies, build scripts,
 * Gradle version catalogs, or dynamically computed dependency coordinates.
 */
export class ManifestParser {
  private static readonly MANIFESTS = new Set([
    'package.json', 'requirements.txt', 'pyproject.toml',
    'cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  ]);

  public static isManifest(filePath: string): boolean {
    return this.MANIFESTS.has(this.basename(filePath));
  }

  public static parse(filePath: string, content: string): ManifestDependency[] {
    try {
      switch (this.basename(filePath)) {
        case 'package.json': return this.parsePackageJson(filePath, content);
        case 'requirements.txt': return this.parseRequirementsTxt(filePath, content);
        case 'pyproject.toml': return this.parsePyprojectToml(filePath, content);
        case 'cargo.toml': return this.parseCargoToml(filePath, content);
        case 'go.mod': return this.parseGoMod(filePath, content);
        case 'pom.xml': return this.parsePomXml(filePath, content);
        case 'build.gradle':
        case 'build.gradle.kts': return this.parseGradle(filePath, content);
        default: return [];
      }
    } catch (error) {
      console.warn(`[ManifestParser] Unable to parse ${filePath}:`, error);
      return [];
    }
  }

  private static basename(path: string): string {
    return path.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  }

  private static add(
    output: ManifestDependency[], file: string, name: string,
    version: string | undefined, type: 'runtime' | 'dev',
  ): void {
    const cleanName = name.trim();
    if (!cleanName) return;
    const cleanVersion = version?.trim() || undefined;
    if (output.some(d => d.manifestFile === file && d.name === cleanName && d.type === type && d.version === cleanVersion)) return;
    output.push({ manifestFile: file, name: cleanName, version: cleanVersion, type });
  }

  private static parsePackageJson(file: string, content: string): ManifestDependency[] {
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const result: ManifestDependency[] = [];
    for (const [section, type] of [
      ['dependencies', 'runtime'], ['optionalDependencies', 'runtime'],
      ['peerDependencies', 'runtime'], ['devDependencies', 'dev'],
    ] as const) {
      const values = pkg[section];
      if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
      for (const [name, version] of Object.entries(values)) {
        this.add(result, file, name, typeof version === 'string' ? version : undefined, type);
      }
    }
    return result;
  }

  private static parseRequirementsTxt(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('-') || line.startsWith('git+') || line.startsWith('http')) continue;
      const match = line.match(/^([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^\]]+\])?\s*(.*)$/);
      if (!match) continue;
      const remainder = match[2].split(/\s+#/)[0].trim();
      const version = remainder.split(';')[0].trim();
      if (version && !/^(?:===|==|!=|~=|>=|<=|>|<)/.test(version)) continue;
      this.add(result, file, match[1].toLowerCase(), version || undefined, 'runtime');
    }
    return result;
  }

  private static parsePyprojectToml(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    let section = '';
    let inArray = false;
    let arrayType: 'runtime' | 'dev' = 'runtime';
    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^\[.+\]$/.test(line)) {
        section = line.slice(1, -1).toLowerCase();
        inArray = false;
        continue;
      }
      const arrayStart = line.match(/^(dependencies|optional-dependencies|dev)\s*=\s*\[/);
      if (section === 'project' && arrayStart?.[1] === 'dependencies') {
        inArray = true;
        arrayType = 'runtime';
      } else if (section === 'dependency-groups' && /^\w[\w-]*\s*=\s*\[/.test(line)) {
        inArray = true;
        arrayType = 'dev';
      }
      if (inArray) {
        const quoted = [...line.matchAll(/['"]([A-Za-z0-9][A-Za-z0-9_.-]*(?:\[[^\]]+\])?(?:\s*(?:===|==|!=|~=|>=|<=|>|<)[^'"]*)?)['"]/g)];
        for (const item of quoted) {
          const match = item[1].match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(.*)$/);
          if (match) this.add(result, file, match[1].toLowerCase(), match[2].split(';')[0].trim() || undefined, arrayType);
        }
        if (line.includes(']')) inArray = false;
        continue;
      }
      const poetry = section === 'tool.poetry.dependencies';
      const poetryGroup = /^tool\.poetry\.group\.[^.]+\.dependencies$/.test(section);
      if (poetry || poetryGroup) {
        const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
        if (!match || match[1].toLowerCase() === 'python') continue;
        const value = match[2].trim();
        const version = value.match(/^['"]([^'"]+)['"]/)?.[1] ?? value.match(/\bversion\s*=\s*['"]([^'"]+)['"]/)?.[1];
        this.add(result, file, match[1].toLowerCase(), version, poetryGroup ? 'dev' : 'runtime');
      }
    }
    return result;
  }

  private static parseCargoToml(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    let section = '';
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (/^\[.+\]$/.test(line)) { section = line.slice(1, -1); continue; }
      const base = section.replace(/^target\..+?\./, '');
      const type: 'runtime' | 'dev' = base.startsWith('dev-dependencies') ? 'dev' : 'runtime';
      if (!/^(?:dev-|build-)?dependencies(?:\.|$)/.test(base)) continue;
      const tableDependency = base.match(/^(?:dev-|build-)?dependencies\.([\w-]+)$/);
      if (tableDependency) {
        const version = line.match(/^version\s*=\s*['"]([^'"]+)['"]/)?.[1];
        if (version) this.add(result, file, tableDependency[1], version, type);
        continue;
      }
      const match = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      if (!match) continue;
      const version = match[2].match(/^['"]([^'"]+)['"]/)?.[1] ?? match[2].match(/\bversion\s*=\s*['"]([^'"]+)['"]/)?.[1];
      this.add(result, file, match[1], version, type);
    }
    return result;
  }

  private static parseGoMod(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    let inBlock = false;
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (line === 'require (') { inBlock = true; continue; }
      if (inBlock && line === ')') { inBlock = false; continue; }
      if (!inBlock && !line.startsWith('require ')) continue;
      const value = inBlock ? line : line.slice('require '.length).trim();
      if (!value || value.startsWith('//')) continue;
      const match = value.match(/^([^\s()]+)\s+(v[^\s()]+)/);
      if (match) this.add(result, file, match[1], match[2], 'runtime');
    }
    return result;
  }

  private static parsePomXml(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    // Scope extraction to each dependency element to avoid crossing element boundaries.
    for (const match of content.matchAll(/<dependency(?:\s[^>]*)?>([\s\S]*?)<\/dependency>/g)) {
      const body = match[1];
      const field = (tag: string): string | undefined => {
        const value = body.match(new RegExp(`<${tag}\\s*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim();
        return value || undefined;
      };
      const artifact = field('artifactId');
      if (!artifact) continue;
      const group = field('groupId');
      const scope = field('scope')?.toLowerCase();
      const type: 'runtime' | 'dev' = scope === 'test' ? 'dev' : 'runtime';
      this.add(result, file, group ? `${group}:${artifact}` : artifact, field('version'), type);
    }
    return result;
  }

  private static parseGradle(file: string, content: string): ManifestDependency[] {
    const result: ManifestDependency[] = [];
    const configurations = new Set([
      'implementation', 'api', 'compile', 'compileOnly', 'runtime', 'runtimeOnly',
      'testImplementation', 'testCompile', 'testCompileOnly', 'testRuntime', 'testRuntimeOnly',
      'integrationTestImplementation', 'integrationTestRuntimeOnly',
      'annotationProcessor', 'kapt', 'ksp', 'classpath', 'providedCompile',
    ]);

    // Only simple literal assignments are resolved. Expressions are intentionally not evaluated.
    const variables = new Map<string, string>();
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      const declaration = line.match(/^(?:(?:def|val|var)\s+)?(?:ext\.)?([A-Za-z_]\w*)\s*=\s*['"]([^'"\r\n]+)['"]\s*(?:\/\/.*)?$/);
      if (declaration) variables.set(declaration[1], declaration[2]);
    }

    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('#')) continue;
      const call = line.match(/^([A-Za-z_]\w*)\s*(?:\(\s*)?(.*)$/);
      if (!call || !configurations.has(call[1])) continue;
      const type: 'runtime' | 'dev' = /^(test|integrationTest)/.test(call[1]) ? 'dev' : 'runtime';
      const args = call[2];

      // Groovy map notation: implementation group: 'x', name: 'y', version: 'z'
      const group = args.match(/\bgroup\s*:\s*['"]([^'"]+)['"]/)?.[1];
      const artifact = args.match(/\bname\s*:\s*['"]([^'"]+)['"]/)?.[1];
      const mapVersion = args.match(/\bversion\s*:\s*['"]([^'"]+)['"]/)?.[1];
      if (group && artifact) {
        this.add(result, file, `${group}:${artifact}`, mapVersion, type);
        continue;
      }

      // Kotlin named arguments: implementation(group = "x", name = "y", version = "z")
      const kotlinGroup = args.match(/\bgroup\s*=\s*['"]([^'"]+)['"]/)?.[1];
      const kotlinName = args.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1];
      const kotlinVersion = args.match(/\bversion\s*=\s*['"]([^'"]+)['"]/)?.[1];
      if (kotlinGroup && kotlinName) {
        this.add(result, file, `${kotlinGroup}:${kotlinName}`, kotlinVersion, type);
        continue;
      }

      const quoted = args.match(/^['"]([^'"]+)['"]/)?.[1];
      if (!quoted) continue; // project(...), libs.foo, platform(...), etc. are not coordinates.
      const parts = quoted.split(':');
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      let version = parts.slice(2).join(':') || undefined;
      if (version) {
        const variableName = version.match(/^\$\{([A-Za-z_]\w*)\}$/)?.[1]
          ?? version.match(/^\$([A-Za-z_]\w*)$/)?.[1];
        if (variableName) version = variables.get(variableName);
        else if (version.includes('$')) version = undefined;
      }
      this.add(result, file, `${parts[0]}:${parts[1]}`, version, type);
    }
    return result;
  }

  /**
   * Resolve common Gradle aliases using repository-wide static configuration.
   * Does not execute Gradle or treat unresolved aliases as real packages.
   */
  public static parseGradleWithContext(
    file: string,
    content: string,
    contextFiles: ReadonlyMap<string, string>
  ): ManifestDependency[] {
    const result = this.parse(file, content);
    const aliases = new Map<string, string>();
    const versions = new Map<string, string>();

    for (const [path, text] of contextFiles) {
      if (path.endsWith('.properties')) {
        for (const match of text.matchAll(/^\s*([\w.-]+)\s*=\s*([^\r\n#!]+)\s*$/gm)) {
          versions.set(match[1], match[2].trim());
        }
      }
      if (/\.gradle(?:\.kts)?$/i.test(path)) {
        // Common Groovy maps: libraries = [guava: 'group:artifact:version']
        for (const map of text.matchAll(/\b(?:ext\.)?(libraries|libs)\s*=\s*\[([\s\S]*?)\]/g)) {
          for (const entry of map[2].matchAll(/([\w.-]+)\s*:\s*['"]([^'"\r\n]+)['"]/g)) {
            aliases.set(`${map[1]}.${entry[1]}`, entry[2]);
          }
        }
        // Individual assignments: libraries.guava = 'group:artifact:version'
        for (const entry of text.matchAll(/\b(libraries|libs)\.([\w.-]+)\s*=\s*['"]([^'"\r\n]+)['"]/g)) {
          aliases.set(`${entry[1]}.${entry[2]}`, entry[3]);
        }
        for (const entry of text.matchAll(/\b(?:def|val|var|ext\.)?\s*([\w.-]+)\s*=\s*['"]([^'"\r\n]+)['"]/g)) {
          if (!entry[2].includes(':')) versions.set(entry[1], entry[2]);
        }
      }
      if (/\.versions\.toml$/i.test(path)) {
        let section = '';
        const versionRefs = new Map<string, string>();
        const libraryRows: Array<[string, string]> = [];
        for (const raw of text.split(/\r?\n/)) {
          const line = raw.replace(/\s+#.*$/, '').trim();
          const header = line.match(/^\[([^\]]+)\]$/);
          if (header) { section = header[1]; continue; }
          const assignment = line.match(/^([\w.-]+)\s*=\s*(.+)$/);
          if (!assignment) continue;
          if (section === 'versions') {
            const v = assignment[2].match(/^['"]([^'"]+)['"]$/)?.[1];
            if (v) versionRefs.set(assignment[1], v);
          } else if (section === 'libraries') {
            libraryRows.push([assignment[1], assignment[2]]);
          }
        }
        for (const [name, value] of libraryRows) {
          const moduleName = value.match(/\bmodule\s*=\s*['"]([^'"]+)['"]/)?.[1];
          const group = value.match(/\bgroup\s*=\s*['"]([^'"]+)['"]/)?.[1];
          const artifact = value.match(/\bname\s*=\s*['"]([^'"]+)['"]/)?.[1];
          const module = moduleName || (group && artifact ? `${group}:${artifact}` : undefined);
          if (!module) continue;
          const explicitVersion = value.match(/\bversion\s*=\s*['"]([^'"]+)['"]/)?.[1];
          const versionRef = value.match(/\bversion\.ref\s*=\s*['"]([^'"]+)['"]/)?.[1];
          const resolvedVersion = explicitVersion || (versionRef ? versionRefs.get(versionRef) : undefined);
          const coordinate = resolvedVersion ? `${module}:${resolvedVersion}` : module;
          // Gradle catalog accessors normalize '-' and '_' to '.'
          aliases.set(`libs.${name.replace(/[-_]/g, '.')}`, coordinate);
        }
      }
    }

    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      const call = line.match(/^(implementation|api|compile|compileOnly|runtimeOnly|testImplementation|testCompile|testRuntimeOnly|kapt|ksp|classpath|annotationProcessor)\s*(?:\(\s*)?(.*)$/);
      if (!call) continue;
      const type: 'runtime' | 'dev' = /^test/.test(call[1]) ? 'dev' : 'runtime';
      const arg = call[2];
      // Only resolve aliases used as arguments, not incidental mentions in comments.
      const alias = arg.match(/^(libraries|libs)\.([\w.-]+)\b/)?.[0];
      if (!alias) continue;
      const coordinate = aliases.get(alias);
      if (!coordinate) continue;
      const parts = coordinate.split(':');
      if (parts.length < 2 || !parts[0] || !parts[1]) continue;
      let version = parts.slice(2).join(':') || undefined;
      if (version) {
        const ref = version.match(/^\$\{?([\w.-]+)\}?$/)?.[1];
        if (ref) version = versions.get(ref);
        else if (version.includes('$')) version = undefined;
      }
      this.add(result, file, `${parts[0]}:${parts[1]}`, version, type);
    }
    return result;
  }

}
