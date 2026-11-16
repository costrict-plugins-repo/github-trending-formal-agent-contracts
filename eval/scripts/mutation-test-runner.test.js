'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  generateMutations, applyMutation, runCommand, classifyJest, runEvaluation,
} = require('./mutation-test-runner.js');

function fixture(t, source, tests, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fac-mutation-regression-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const project = path.join(directory, 'project');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, 'rules.ts'), source);
  fs.writeFileSync(path.join(project, 'rules.test.ts'), tests);
  return {
    directory, project,
    settings: { project, source: 'rules.ts', tests: ['rules.test.ts'],
      output: path.join(directory, 'result'), ...options },
  };
}

test('AST mutants change one expression token and preserve generics, strings, and comments', () => {
  const source = `type Index = Map<string, number>;
    // x < y; do not change this comment
    const label = "x > y";
    export const f = (x: number) => x < 2 && x > 0;
    export const g = (x: number) => x + 1;
    export const h = <T>(x: T): T => x;`;
  const mutants = generateMutations(source);
  assert.equal(mutants.length, 3);
  assert.equal(new Set(mutants.map((m) => m.start)).size, 3);
  for (const mutation of mutants) {
    const changed = applyMutation(source, mutation);
    assert.equal(changed.slice(0, mutation.start), source.slice(0, mutation.start));
    assert.equal(changed.slice(mutation.start + mutation.replacement.length), source.slice(mutation.end));
    assert.ok(changed.includes('Map<string, number>'));
    assert.ok(changed.includes('// x < y; do not change this comment'));
    assert.ok(changed.includes('"x > y"'));
    assert.ok(changed.includes('<T>(x: T)'));
  }
  assert.throws(() => applyMutation('different input', mutants[0]), /no longer matches/);
});

test('real Jest: passing baseline, killed and surviving mutants, unchanged input, complete evidence', (t) => {
  const source = 'export const positive = (n: number) => n > 0;\nexport const unused = (n: number) => n + 1;';
  const { settings, project } = fixture(t, source,
    "import { positive } from './rules'; test('zero boundary', () => expect(positive(0)).toBe(false));");
  // A separate gold-test file must never be mistaken for the selected implementation.
  fs.writeFileSync(path.join(project, '__gold_tests__.ts'), 'export const irrelevant = 42;');
  const report = runEvaluation(settings);
  assert.equal(report.status, 'completed', JSON.stringify(report.baseline));
  assert.equal(report.baseline.status, 'passed');
  assert.deepEqual(report.mutations.map((m) => m.status), ['killed', 'survived']);
  assert.equal(report.summary.killRate, 0.5);
  assert.equal(report.summary.scoredMutants, 2);
  assert.equal(report.summary.excludedMutants, 0);
  assert.equal(fs.readFileSync(path.join(project, 'rules.ts'), 'utf8'), source);
  assert.equal(report.inputs.length, 3);
  assert.match(report.evidence.packageLockSha256, /^[a-f0-9]{64}$/);
  const saved = JSON.parse(fs.readFileSync(path.join(settings.output, 'report.json'), 'utf8'));
  assert.equal(saved.status, 'completed');
  for (const result of [report.baseline, ...report.mutations]) {
    assert.ok(fs.existsSync(path.join(result.directory, 'jest-result.json')));
    assert.ok(fs.existsSync(path.join(result.directory, 'jest.command.json')));
    assert.ok(fs.existsSync(path.join(result.directory, 'typecheck.stdout.log')));
  }
  assert.throws(() => runEvaluation(settings), /EEXIST/);
});

test('a failing unmutated baseline stops all mutation scoring', (t) => {
  const { settings } = fixture(t, 'export const positive = (n: number) => n > 0;',
    "import { positive } from './rules'; test('broken baseline', () => expect(positive(0)).toBe(true));");
  const report = runEvaluation(settings);
  assert.equal(report.status, 'baseline-failed');
  assert.equal(report.baseline.status, 'failed');
  assert.deepEqual(report.mutations, []);
  assert.equal(report.summary, undefined);
});

test('no executed tests cannot pass a baseline', (t) => {
  const { settings } = fixture(t, 'export const positive = (n: number) => n > 0;',
    "test.skip('not executed', () => expect(true).toBe(true));");
  const report = runEvaluation(settings);
  assert.equal(report.status, 'baseline-failed');
  assert.equal(report.baseline.status, 'no-tests');
  assert.deepEqual(report.mutations, []);
});

test('a genuinely empty Jest suite cannot pass a baseline', (t) => {
  const { settings } = fixture(t, 'export const positive = (n: number) => n > 0;', 'export {};');
  const report = runEvaluation(settings);
  assert.equal(report.status, 'baseline-failed');
  assert.equal(report.baseline.status, 'no-tests');
  assert.deepEqual(report.mutations, []);
});

test('a mutant that skips a formerly executed test is incomplete, never survived', (t) => {
  const { settings } = fixture(t, 'export const enabled = (n: number) => n > 0;',
    `import { enabled } from './rules';
     (enabled(0) ? test.skip : test)('conditional assertion', () => expect(true).toBe(true));
     test('always present', () => expect(true).toBe(true));`);
  const report = runEvaluation(settings);
  assert.equal(report.baseline.status, 'passed');
  assert.equal(report.status, 'incomplete');
  assert.equal(report.mutations[0].status, 'infra-error');
  assert.equal(report.summary.scoredMutants, 0);
});

test('a mutant causing a setup hook failure is infra-error, never an assertion kill', (t) => {
  const { settings } = fixture(t, 'export const enabled = (n: number) => n > 0;',
    `import { enabled } from './rules';
     beforeAll(() => { if (enabled(0)) throw new Error('setup unavailable'); });
     test('not reached on failed setup', () => expect(true).toBe(true));`);
  const report = runEvaluation(settings);
  assert.equal(report.baseline.status, 'passed');
  assert.equal(report.status, 'incomplete');
  assert.equal(report.mutations[0].status, 'infra-error');
  assert.equal(report.summary.counts.killed, 0);
  const events = fs.readFileSync(path.join(report.mutations[0].directory, 'jest-events.jsonl'), 'utf8');
  assert.match(events, /hook_failure/);
});

test('mutation compile errors are excluded from the kill-rate denominator', (t) => {
  const { settings } = fixture(t, "export const label = (n: number): string => 'value:' + n;",
    "import { label } from './rules'; test('string concatenation', () => expect(label(1)).toBe('value:1'));");
  const report = runEvaluation(settings);
  assert.equal(report.baseline.status, 'passed');
  assert.equal(report.mutations.length, 1);
  assert.equal(report.mutations[0].status, 'compile-error');
  assert.ok(report.mutations[0].diagnostics.length > 0);
  assert.equal(report.summary.counts.killed, 0);
  assert.equal(report.summary.excludedMutants, 1);
  assert.equal(report.summary.killRate, null);
});

test('Jest suite loading failure is infra-error, never killed', (t) => {
  const { settings } = fixture(t, 'export const positive = (n: number) => n > 0;',
    "throw new Error('fixture loader unavailable'); test('not reached', () => expect(true).toBe(true));");
  const report = runEvaluation(settings);
  assert.equal(report.status, 'baseline-failed');
  assert.equal(report.baseline.status, 'infra-error');
  assert.deepEqual(report.mutations, []);
});

test('Jest test timeout is timeout, never an assertion kill', (t) => {
  const { settings } = fixture(t, 'export const positive = (n: number) => n > 0;',
    "test('never resolves', async () => { await new Promise<void>(() => {}); });",
    { testTimeoutMs: 50 });
  const report = runEvaluation(settings);
  assert.equal(report.status, 'baseline-failed');
  assert.equal(report.baseline.status, 'timeout');
  assert.deepEqual(report.mutations, []);
});

test('missing executable and process deadline produce different non-kill states', (t) => {
  const { directory } = fixture(t, 'export {};', 'export {};');
  const missing = runCommand(path.join(directory, 'missing-executable'), [], {
    cwd: directory, timeoutMs: 500, prefix: path.join(directory, 'missing'),
  });
  assert.equal(classifyJest(missing, null, []).status, 'infra-error');
  const stalled = runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    cwd: directory, timeoutMs: 100, prefix: path.join(directory, 'stalled'),
  });
  assert.equal(classifyJest(stalled, null, []).status, 'timeout');
});

test('unselected, incomplete, or inconsistent Jest results cannot be treated as kills', () => {
  const command = { cwd: '/fixture', exitCode: 1, error: null, signal: null };
  assert.equal(classifyJest(command, null, ['/fixture/rules.test.ts']).status, 'infra-error');
  const report = { success: false, numTotalTests: 1, numFailedTests: 1, numPassedTests: 0,
    testResults: [{ name: '/fixture/other.test.ts', status: 'failed',
      assertionResults: [{ status: 'failed', fullName: 'assertion' }] }] };
  assert.equal(classifyJest(command, report, ['/fixture/rules.test.ts']).status, 'infra-error');
  report.testResults[0].name = '/fixture/rules.test.ts';
  report.numFailedTests = 7;
  assert.equal(classifyJest(command, report, ['/fixture/rules.test.ts']).status, 'infra-error');
  report.numFailedTests = 1;
  assert.equal(classifyJest(command, report, ['/fixture/rules.test.ts'], ['different assertion']).status, 'infra-error');
});

test('selection is explicit and historical results cannot be overwritten', (t) => {
  const { settings } = fixture(t, 'export const n = 1;', "test('ok', () => expect(true).toBe(true));");
  assert.throws(() => runEvaluation({ ...settings, tests: [] }), /distinct explicit test/);
  assert.throws(() => runEvaluation({ ...settings, source: 'rules.test.ts' }), /never mutate test files/);
  assert.throws(() => runEvaluation({ ...settings, source: '../outside.ts' }), /inside --project/);
  assert.throws(() => runEvaluation({ ...settings,
    output: path.resolve(__dirname, '../results/new-output') }), /historical/);
});
