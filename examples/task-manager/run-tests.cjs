#!/usr/bin/env node
// Compile into a temporary directory and test the real module with contract checks on.
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = mkdtempSync(path.join(tmpdir(), 'task-manager-test-'));
try {
  const compiler = require.resolve('typescript/bin/tsc');
  const compilation = spawnSync(process.execPath, [compiler,
    '--target', 'ES2020', '--module', 'commonjs', '--strict', '--esModuleInterop',
    '--skipLibCheck', '--types', 'node', '--outDir', output,
    path.join(__dirname, 'generated/task-manager.ts'),
    path.join(__dirname, 'generated/test-task-manager.ts'),
  ], { cwd: root, stdio: 'inherit' });
  if (compilation.error) throw compilation.error;
  if (compilation.status !== 0) process.exitCode = compilation.status || 1;
  else {
    const result = spawnSync(process.execPath, ['--test', path.join(output, 'test-task-manager.js')], {
      cwd: root, stdio: 'inherit', env: { ...process.env, VDM_CONTRACT_CHECK: 'on' },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status === 0 ? 0 : (result.status || 1);
  }
} finally {
  rmSync(output, { recursive: true, force: true });
}
