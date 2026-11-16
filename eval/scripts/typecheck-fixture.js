'use strict';
// Separate process gives compile diagnostics an explicit exit code and time limit.
const path = require('node:path');
const ts = require('typescript');
try {
  const [workspace, ...files] = process.argv.slice(2);
  const program = ts.createProgram(files.map((file) => path.resolve(workspace, file)), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: true,
    types: ['node', 'jest'], typeRoots: [path.resolve(__dirname, '../../node_modules/@types')],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const position = diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : null;
    return {
      code: diagnostic.code, category: ts.DiagnosticCategory[diagnostic.category],
      file: diagnostic.file ? path.relative(workspace, diagnostic.file.fileName) : null,
      line: position ? position.line + 1 : null, column: position ? position.character + 1 : null,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    };
  });
  console.log(JSON.stringify(diagnostics));
  process.exitCode = diagnostics.length ? 1 : 0;
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 2;
}
