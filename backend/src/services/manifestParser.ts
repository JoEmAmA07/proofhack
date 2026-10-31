import { ManifestDependency } from '../types/repository.js';

/**
 * Extracts declared dependencies from project manifest files.
 * Supported manifests:
 * - package.json (Node.js / JS / TS)
 * - requirements.txt (Python)
 * - pyproject.toml (Python Poetry / PEP 621)
 * - Cargo.toml (Rust)
 * - go.mod (Go)
 * - pom.xml (Java Maven)
 */
export class ManifestParser {
  /**
   * Identifies whether a given repository file path is a supported package manifest.
   */
  public static isManifest(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const basename = lower.split('/').pop() || '';
    return (
      basename === 'package.json' ||
      basename === 'requirements.txt' ||
      basename === 'pyproject.toml' ||
      basename === 'cargo.toml' ||
      basename === 'go.mod' ||
      basename === 'pom.xml'
    );
  }

  /**
   * Parses the textual content of a manifest file and extracts dependencies.
   */
  public static parse(filePath: string, content: string): ManifestDependency[] {
    const lower = filePath.toLowerCase();
    const basename = lower.split('/').pop() || '';

    try {
      if (basename === 'package.json') {
        return this.parsePackageJson(filePath, content);
      }
      if (basename === 'requirements.txt') {
        return this.parseRequirementsTxt(filePath, content);
      }
      if (basename === 'pyproject.toml') {
        return this.parsePyprojectToml(filePath, content);
      }
      if (basename === 'cargo.toml') {
        return this.parseCargoToml(filePath, content);
      }
      if (basename === 'go.mod') {
        return this.parseGoMod(filePath, content);
      }
      if (basename === 'pom.xml') {
        return this.parsePomXml(filePath, content);
      }
    } catch (_err) {
      // Return empty array if manifest is malformed
      return [];
    }

    return [];
  }

  private static parsePackageJson(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    const pkg = JSON.parse(content);

    if (pkg.dependencies && typeof pkg.dependencies === 'object') {
      for (const [name, ver] of Object.entries(pkg.dependencies)) {
        deps.push({
          manifestFile: filePath,
          name,
          version: typeof ver === 'string' ? ver : undefined,
          type: 'runtime',
        });
      }
    }

    if (pkg.devDependencies && typeof pkg.devDependencies === 'object') {
      for (const [name, ver] of Object.entries(pkg.devDependencies)) {
        deps.push({
          manifestFile: filePath,
          name,
          version: typeof ver === 'string' ? ver : undefined,
          type: 'dev',
        });
      }
    }

    return deps;
  }

  private static parseRequirementsTxt(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    const lines = content.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      // Skip comments, empty lines, and pip flags
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;

      // Extract package name before ==, >=, <=, ~=, <, >, !=, ;
      const match = line.match(/^([a-zA-Z0-9_.-]+)(?:([=><~!].*))?$/);
      if (match) {
        deps.push({
          manifestFile: filePath,
          name: match[1].toLowerCase(),
          version: match[2]?.trim(),
          type: 'runtime',
        });
      }
    }

    return deps;
  }

  private static parsePyprojectToml(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    let inDepsSection = false;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('[tool.poetry.dependencies]') || line.startsWith('[project.dependencies]')) {
        inDepsSection = true;
        continue;
      }
      if (inDepsSection && line.startsWith('[')) {
        inDepsSection = false;
        continue;
      }
      if (inDepsSection && line && !line.startsWith('#')) {
        const match = line.match(/^([a-zA-Z0-9_.-]+)\s*=\s*(.+)$/);
        if (match) {
          deps.push({
            manifestFile: filePath,
            name: match[1].toLowerCase(),
            version: match[2].replace(/["']/g, '').trim(),
            type: 'runtime',
          });
        }
      }
    }

    return deps;
  }

  private static parseCargoToml(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    let currentType: 'runtime' | 'dev' = 'runtime';
    let inDepsSection = false;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('[dependencies]')) {
        inDepsSection = true;
        currentType = 'runtime';
        continue;
      }
      if (line.startsWith('[dev-dependencies]')) {
        inDepsSection = true;
        currentType = 'dev';
        continue;
      }
      if (inDepsSection && line.startsWith('[')) {
        inDepsSection = false;
        continue;
      }
      if (inDepsSection && line && !line.startsWith('#')) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
        if (match) {
          deps.push({
            manifestFile: filePath,
            name: match[1],
            version: match[2].replace(/["']/g, '').trim(),
            type: currentType,
          });
        }
      }
    }

    return deps;
  }

  private static parseGoMod(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    let inRequireBlock = false;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line === 'require (') {
        inRequireBlock = true;
        continue;
      }
      if (inRequireBlock && line === ')') {
        inRequireBlock = false;
        continue;
      }

      if (inRequireBlock) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2 && !parts[0].startsWith('//')) {
          deps.push({
            manifestFile: filePath,
            name: parts[0],
            version: parts[1],
            type: 'runtime',
          });
        }
      } else if (line.startsWith('require ')) {
        const parts = line.slice(8).trim().split(/\s+/);
        if (parts.length >= 2) {
          deps.push({
            manifestFile: filePath,
            name: parts[0],
            version: parts[1],
            type: 'runtime',
          });
        }
      }
    }

    return deps;
  }

  private static parsePomXml(filePath: string, content: string): ManifestDependency[] {
    const deps: ManifestDependency[] = [];
    const depRegex = /<dependency>[\s\S]*?<artifactId>(.*?)<\/artifactId>[\s\S]*?<\/dependency>/g;
    let match: RegExpExecArray | null;

    while ((match = depRegex.exec(content)) !== null) {
      deps.push({
        manifestFile: filePath,
        name: match[1].trim(),
        type: 'runtime',
      });
    }

    return deps;
  }
}
