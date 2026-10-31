import ts from 'typescript';
import { AnalyzedFile } from '../types/repository.js';

/**
 * Deterministic code analyzer that parses source files.
 * Uses the official TypeScript compiler AST for JavaScript and TypeScript files,
 * and conservative text/regex analysis for Python, Go, Rust, and Java.
 */
export class CodeAnalyzer {
  /**
   * Analyzes a source file and extracts imports, function definitions, classes, and API routes.
   */
  public static analyze(filePath: string, content: string): AnalyzedFile {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const size = Buffer.byteLength(content, 'utf-8');

    if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      return this.analyzeJsTs(filePath, content, ext, size);
    }

    if (['py', 'go', 'rs', 'java', 'rb', 'php'].includes(ext)) {
      return this.analyzeOtherLanguages(filePath, content, ext, size);
    }

    return {
      path: filePath,
      language: ext,
      size,
      content,
      imports: [],
      functions: [],
      classes: [],
      routes: [],
    };
  }

  /**
   * Deterministic AST extraction for JS/TS using the TypeScript compiler API.
   */
  private static analyzeJsTs(
    filePath: string,
    content: string,
    ext: string,
    size: number
  ): AnalyzedFile {
    const isTs = ext === 'ts' || ext === 'tsx';
    const isJsx = ext === 'tsx' || ext === 'jsx';

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      isJsx ? ts.ScriptKind.TSX : isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );

    const imports: string[] = [];
    const functions: Array<{ name: string; lineStart: number; lineEnd: number }> = [];
    const classes: Array<{ name: string; lineStart: number; lineEnd: number }> = [];
    const routes: Array<{ method: string; path: string; lineStart: number; lineEnd: number }> = [];

    const getLines = (node: ts.Node) => {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      return {
        lineStart: start.line + 1,
        lineEnd: end.line + 1,
      };
    };

    const visit = (node: ts.Node) => {
      // 1. Import Declarations
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          imports.push(node.moduleSpecifier.text);
        }
      }

      // Require calls
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push(node.arguments[0].text);
      }

      // 2. Function Declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const { lineStart, lineEnd } = getLines(node);
        functions.push({
          name: node.name.text,
          lineStart,
          lineEnd,
        });
      }

      // Variable statements with arrow functions: const verifyAuth = () => {}
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isIdentifier(decl.name) &&
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
          ) {
            const { lineStart, lineEnd } = getLines(decl);
            functions.push({
              name: decl.name.text,
              lineStart,
              lineEnd,
            });
          }
        }
      }

      // 3. Class Declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const { lineStart, lineEnd } = getLines(node);
        classes.push({
          name: node.name.text,
          lineStart,
          lineEnd,
        });
      }

      // 4. Express / Router Route Calls: app.get('/api/users', ...), router.post('/login', ...)
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const propName = node.expression.name.text.toLowerCase();
        const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'use']);

        if (HTTP_METHODS.has(propName) && node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          let routePath = '';
          if (ts.isStringLiteral(firstArg)) {
            routePath = firstArg.text;
          }

          if (routePath.startsWith('/') || propName === 'use') {
            const { lineStart, lineEnd } = getLines(node);
            routes.push({
              method: propName.toUpperCase(),
              path: routePath || '*',
              lineStart,
              lineEnd,
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      path: filePath,
      language: isTs ? 'typescript' : 'javascript',
      size,
      content,
      imports: Array.from(new Set(imports)),
      functions,
      classes,
      routes,
    };
  }

  /**
   * Conservative line-by-line regex extraction for Python, Go, Rust, Java.
   */
  private static analyzeOtherLanguages(
    filePath: string,
    content: string,
    ext: string,
    size: number
  ): AnalyzedFile {
    const lines = content.split('\n');
    const imports: string[] = [];
    const functions: Array<{ name: string; lineStart: number; lineEnd: number }> = [];
    const classes: Array<{ name: string; lineStart: number; lineEnd: number }> = [];
    const routes: Array<{ method: string; path: string; lineStart: number; lineEnd: number }> = [];

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();

      // Python
      if (ext === 'py') {
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
          const mod = trimmed.split(/\s+/)[1];
          if (mod) imports.push(mod.replace(/[,;]/g, ''));
        }
        if (trimmed.startsWith('def ')) {
          const fnName = trimmed.match(/^def\s+([a-zA-Z0-9_]+)/)?.[1];
          if (fnName) functions.push({ name: fnName, lineStart: lineNum, lineEnd: lineNum + 5 });
        }
        if (trimmed.startsWith('class ')) {
          const clsName = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/)?.[1];
          if (clsName) classes.push({ name: clsName, lineStart: lineNum, lineEnd: lineNum + 10 });
        }
        if (trimmed.includes('@app.route(') || trimmed.includes('@router.')) {
          const pathMatch = trimmed.match(/['"](\/[^'"]*)['"]/);
          routes.push({
            method: trimmed.includes('post') ? 'POST' : 'GET',
            path: pathMatch ? pathMatch[1] : '/',
            lineStart: lineNum,
            lineEnd: lineNum + 2,
          });
        }
      }

      // Go
      if (ext === 'go') {
        if (trimmed.startsWith('func ')) {
          const fnName = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)/)?.[1];
          if (fnName) functions.push({ name: fnName, lineStart: lineNum, lineEnd: lineNum + 5 });
        }
      }

      // Rust
      if (ext === 'rs') {
        if (trimmed.startsWith('pub fn ') || trimmed.startsWith('fn ')) {
          const fnName = trimmed.match(/^fn\s+([a-zA-Z0-9_]+)/)?.[1];
          if (fnName) functions.push({ name: fnName, lineStart: lineNum, lineEnd: lineNum + 5 });
        }
      }

      // Java
      if (ext === 'java') {
        if (trimmed.startsWith('import ')) {
          const mod = trimmed.replace('import ', '').replace(';', '').trim();
          imports.push(mod);
        }
      }
    });

    return {
      path: filePath,
      language: ext,
      size,
      content,
      imports: Array.from(new Set(imports)),
      functions,
      classes,
      routes,
    };
  }
}
