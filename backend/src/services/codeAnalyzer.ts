import ts from 'typescript';
import { AnalyzedFile, FunctionCall } from '../types/repository.js';


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

    if (ext === 'java') {
      return this.analyzeJava(filePath, content, size);
    }

    if (['py', 'go', 'rs', 'rb', 'php'].includes(ext)) {
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
    const calls: FunctionCall[] = [];


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

      // Detect functions assigned to object properties:
      // app.route = function route(path) {}
      // app[method] = function(path) {}
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        (
          ts.isPropertyAccessExpression(node.left) ||
          ts.isElementAccessExpression(node.left)
        ) &&
        (
          ts.isFunctionExpression(node.right) ||
          ts.isArrowFunction(node.right)
        )
      ) {
        const { lineStart, lineEnd } = getLines(node);

        const assignedName = node.left.getText(sourceFile);

        functions.push({
          name: assignedName,
          lineStart,
          lineEnd,
        });
      }

      // Detect methods inside classes and object literals.
      if (ts.isMethodDeclaration(node)) {
        const { lineStart, lineEnd } = getLines(node);

        functions.push({
          name: node.name.getText(sourceFile),
          lineStart,
          lineEnd,
        });
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

      // Extract static function-call relationships.
      // This does NOT prove that the calls execute at runtime.
      if (ts.isCallExpression(node)) {
        let parent: ts.Node | undefined = node.parent;
        let caller = '';

        while (parent) {

          // A named function expression is its own caller scope.
          // Stop here rather than attributing its calls to an outer function.

          if (ts.isFunctionExpression(parent)) {
            const owner = parent.parent;

            if (
              ts.isBinaryExpression(owner) &&
              owner.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              owner.right === parent
            ) {
              caller = owner.left.getText(sourceFile);
            } else if (
              ts.isVariableDeclaration(owner) &&
              ts.isIdentifier(owner.name) &&
              owner.initializer === parent
            ) {
              caller = owner.name.text;
            } else {
              caller = parent.name?.text ?? '';
            }

            break;
          }


          // An unnamed arrow function or callback has no reliable
          // caller name yet, so do not attribute its calls to the outer function.

          if (ts.isArrowFunction(parent)) {
            const owner = parent.parent;

            if (
              ts.isVariableDeclaration(owner) &&
              ts.isIdentifier(owner.name) &&
              owner.initializer === parent
            ) {
              caller = owner.name.text;
            } else if (
              ts.isBinaryExpression(owner) &&
              owner.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              owner.right === parent
            ) {
              caller = owner.left.getText(sourceFile);
            } else {
              // Anonymous callbacks have no reliable caller name.
              caller = '';
            }

            break;
          }


          if (
            ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            (
              ts.isFunctionExpression(parent.right) ||
              ts.isArrowFunction(parent.right)
            )
          ) {
            caller = parent.left.getText(sourceFile);
            break;
          }

          if (ts.isFunctionDeclaration(parent) && parent.name) {
            caller = parent.name.text;
            break;
          }

          if (ts.isMethodDeclaration(parent)) {
            caller = parent.name.getText(sourceFile);
            break;
          }

          if (
            ts.isVariableDeclaration(parent) &&
            ts.isIdentifier(parent.name) &&
            parent.initializer &&
            (
              ts.isArrowFunction(parent.initializer) ||
              ts.isFunctionExpression(parent.initializer)
            )
          ) {
            caller = parent.name.text;
            break;
          }

          parent = parent.parent;
        }

        if (caller) {
          const callee = node.expression.getText(sourceFile);
          const { lineStart } = getLines(node);

          calls.push({
            caller,
            callee,
            line: lineStart,
          });
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
      calls,
    };
  }

  /**
   * Best-effort Java structural analysis. This is not a full Java parser.
   * Strips comments and string contents while retaining line positions.
   */
  private static analyzeJava(filePath: string, content: string, size: number): AnalyzedFile {
    const lines = content.split('\n');
    const imports: string[] = [];
    const functions: AnalyzedFile['functions'] = [];
    const classes: AnalyzedFile['classes'] = [];
    const routes: AnalyzedFile['routes'] = [];
    const calls: FunctionCall[] = [];

    // Preserve newlines and character offsets; mask comments, strings, and chars.
    const masked = content.replace(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      (match) => match.replace(/[^\n]/g, ' ')
    );
    const cleanLines = masked.split('\n');
    const starts: number[] = [];
    let offset = 0;
    for (const line of cleanLines) {
      starts.push(offset);
      offset += line.length + 1;
    }
    const lineAt = (pos: number): number => {
      let low = 0, high = starts.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (starts[mid] <= pos) low = mid + 1;
        else high = mid - 1;
      }
      return high + 1;
    };
    const endOfBlock = (open: number): number => {
      let depth = 0;
      for (let i = open; i < masked.length; i++) {
        if (masked[i] === '{') depth++;
        else if (masked[i] === '}' && --depth === 0) return lineAt(i);
      }
      return lineAt(open);
    };

    lines.forEach((line) => {
      const match = line.trim().match(/^import\s+(?:static\s+)?([\w.*]+)\s*;/);
      if (match) imports.push(match[1]);
    });

    const classPattern = /\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)\b[^;{}]*\{/g;
    let match: RegExpExecArray | null;
    while ((match = classPattern.exec(masked))) {
      const brace = masked.indexOf('{', match.index);
      classes.push({ name: match[1], lineStart: lineAt(match.index), lineEnd: endOfBlock(brace) });
    }

    // Method/constructor declarations with a body. Exclude control structures
    // and invocation expressions; require a declaration-like prefix.
    const methodPattern = /(?:^|[;{}\n])\s*((?:(?:@[\w.]+(?:\([^\n]*?\))?\s*)|(?:public|private|protected|static|final|abstract|synchronized|native|default|strictfp)\s+)*)(?:<[^{};\n]+>\s*)?([\w.$<>?,\[\]\s]+?)\s+([A-Za-z_$][\w$]*)\s*\(([^{};]*?)\)\s*(?:throws\s+[\w.,\s]+)?\s*\{/g;
    const excluded = new Set(['if', 'for', 'while', 'switch', 'catch', 'try', 'else', 'do', 'new', 'return', 'throw', 'synchronized']);
    while ((match = methodPattern.exec(masked))) {
      const name = match[3];
      const prefix = match[2].trim();
      if (excluded.has(name) || excluded.has(prefix.split(/\s+/)[0])) continue;
      // Require return type or a constructor whose name matches a declared class.
      const constructor = classes.some((cls) => cls.name === name);
      if (!prefix && !constructor) continue;
      const brace = masked.indexOf('{', match.index + match[0].lastIndexOf(')'));
      if (brace < 0) continue;
      functions.push({ name, lineStart: lineAt(match.index + match[0].indexOf(name)), lineEnd: endOfBlock(brace) });
    }

    // Deliberately omit Java calls: without a proper parser, a regex call graph
    // could misattribute calls to the wrong method and create false evidence.
    return {
      path: filePath, language: 'java', size, content,
      imports: [...new Set(imports)], functions, classes, routes, calls
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
        if (/^(?:async\s+)?def\s+/.test(trimmed)) {
          const fnName = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)/)?.[1];
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
        if (/^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+/.test(trimmed)) {
          const fnName = trimmed.match(/^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/)?.[1];
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
