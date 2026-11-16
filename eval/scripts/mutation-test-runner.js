#!/usr/bin/env node
'use strict';

// Local Jest/TypeScript fixture runner. This is not a causal plugin evaluation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '../..');
const STATUSES = ['killed', 'survived', 'compile-error', 'timeout', 'infra-error'];
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);

/** Select one expression token per mutant; types/comments/strings are untouched. */
function generateMutations(sourceCode, sourceFile = 'source.ts') {
  const source = ts.createSourceFile(sourceFile, sourceCode, ts.ScriptTarget.Latest, true);
  const mutations = [];
  const replacements = new Map([
    [ts.SyntaxKind.LessThanToken, '<='], [ts.SyntaxKind.LessThanEqualsToken, '<'],
    [ts.SyntaxKind.GreaterThanToken, '>='], [ts.SyntaxKind.GreaterThanEqualsToken, '>'],
    [ts.SyntaxKind.PlusToken, '-'], [ts.SyntaxKind.MinusToken, '+'],
  ]);
  function visit(node) {
    if (ts.isBinaryExpression(node) && replacements.has(node.operatorToken.kind)) {
      const token = node.operatorToken;
      const start = token.getStart(source);
      const position = source.getLineAndCharacterOfPosition(start);
      mutations.push({
        id: `m${String(mutations.length + 1).padStart(4, '0')}`,
        operator: [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(token.kind)
          ? 'arithmetic' : 'boundary',
        start, end: token.end, original: sourceCode.slice(start, token.end),
        replacement: replacements.get(token.kind),
        line: position.line + 1, column: position.character + 1,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return mutations;
}

function applyMutation(sourceCode, mutation) {
  if (sourceCode.slice(mutation.start, mutation.end) !== mutation.original) {
    throw new Error('Mutation location no longer matches the original source');
  }
  return sourceCode.slice(0, mutation.start) + mutation.replacement + sourceCode.slice(mutation.end);
}

/** No shell and no npx: only already-installed local executables. */
function runCommand(executable, args, { cwd, timeoutMs, prefix }) {
  const started = Date.now();
  const result = spawnSync(executable, args, {
    cwd, encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
  });
  fs.writeFileSync(prefix + '.stdout.log', result.stdout || '');
  fs.writeFileSync(prefix + '.stderr.log', result.stderr || '');
  const evidence = {
    executable, args, cwd, durationMs: Date.now() - started,
    exitCode: result.status, signal: result.signal,
    error: result.error ? { code: result.error.code, message: result.error.message } : null,
    stdout: path.basename(prefix) + '.stdout.log', stderr: path.basename(prefix) + '.stderr.log',
  };
  writeJSON(prefix + '.command.json', evidence);
  return { ...evidence, stdoutText: result.stdout || '', stderrText: result.stderr || '' };
}

function processFailure(command) {
  if (command.error?.code === 'ETIMEDOUT') return 'timeout';
  if (command.error || command.signal) return 'infra-error';
  return null;
}

/** Require complete assertion results; process failure alone is never a kill. */
function classifyJest(command, report, expectedTests, baselineIdentities, events) {
  const failure = processFailure(command);
  if (failure) return { status: failure, reason: command.error?.message || command.signal };
  if (!report || !Array.isArray(report.testResults)) {
    return { status: 'infra-error', reason: 'Jest did not produce a valid JSON report' };
  }
  const suites = report.testResults;
  if (suites.length !== expectedTests.length ||
      expectedTests.some((file) => !suites.some((suite) => path.resolve(suite.name) === file))) {
    return { status: 'infra-error', reason: 'Executed test files differ from the explicit selection' };
  }
  if (suites.some((suite) => !Array.isArray(suite.assertionResults))) {
    return { status: 'infra-error', reason: 'Missing suite assertion results' };
  }
  const assertions = suites.flatMap((suite) => suite.assertionResults);
  const messages = suites.map((suite) => suite.message || '').join('\n') + '\n' +
    assertions.flatMap((assertion) => assertion.failureMessages || []).join('\n');
  if (/Exceeded timeout of [\d,]+ ms for a (?:test|hook)/.test(messages)) {
    return { status: 'timeout', reason: 'Jest test or hook exceeded its timeout' };
  }
  if (/Your test suite must contain at least one test/.test(messages)) {
    return { status: 'no-tests', reason: 'Jest test suite contains no assertions' };
  }
  if (report.numRuntimeErrorTestSuites > 0 || suites.some((suite) => suite.testExecError)) {
    return { status: 'infra-error', reason: 'Jest suite loading or runtime infrastructure failed' };
  }
  const passed = assertions.filter((assertion) => assertion.status === 'passed').length;
  const failed = assertions.filter((assertion) => assertion.status === 'failed').length;
  if (passed + failed === 0) return { status: 'no-tests', reason: 'No test assertions executed' };
  if (events !== undefined && (!Array.isArray(events) ||
      events.some((event) => ['hook_failure', 'error', 'test_retry'].includes(event.event)) ||
      expectedTests.some((file) => events.filter((event) =>
        event.event === 'run_finish' && event.testPath === file).length !== 1))) {
    return { status: 'infra-error', reason: 'Hook/global/retry failure or missing execution-phase evidence' };
  }
  if (assertions.length !== report.numTotalTests || passed !== report.numPassedTests ||
      failed !== report.numFailedTests || suites.some((suite) =>
        suite.status === 'failed' && !suite.assertionResults.some((a) => a.status === 'failed'))) {
    return { status: 'infra-error', reason: 'Inconsistent or incomplete Jest assertion totals' };
  }
  const identities = suites.flatMap((suite) => suite.assertionResults.map((a) =>
    `${path.relative(command.cwd, suite.name)}:${a.fullName}:${['passed', 'failed'].includes(a.status) ? 'executed' : a.status}`)).sort();
  if (baselineIdentities && JSON.stringify(identities) !== JSON.stringify(baselineIdentities)) {
    return { status: 'infra-error', reason: 'Test identities or execution/skip states changed after mutation' };
  }
  if (failed > 0 && command.exitCode === 1 && report.success === false) {
    return { status: 'failed', passed, failed, identities };
  }
  if (failed === 0 && command.exitCode === 0 && report.success === true) {
    return { status: 'passed', passed, failed, identities };
  }
  return { status: 'infra-error', reason: 'Jest exit status and assertion results disagree' };
}

function inventory(project, output) {
  const files = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, item.name);
      if (within(output, absolute) || ['node_modules', '.git', '.DS_Store', 'artifacts'].includes(item.name)) continue;
      if (item.isSymbolicLink()) throw new Error(`Project symlinks are unsupported: ${absolute}`);
      if (item.isDirectory()) walk(absolute);
      else if (item.isFile()) files.push({ path: path.relative(project, absolute), sha256: hash(fs.readFileSync(absolute)) });
    }
  }
  walk(project);
  return files;
}

function checkSelection(project, relative, label) {
  const absolute = path.resolve(project, relative);
  if (!within(project, absolute) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`${label} must be an existing file inside --project: ${relative}`);
  }
  if (!/\.[cm]?tsx?$/.test(relative) || /\.d\.ts$/.test(relative)) {
    throw new Error(`${label} must be a TypeScript source/test file: ${relative}`);
  }
  return path.relative(project, absolute);
}

function runCase({ directory, snapshot, files, source, tests, mutation, options, baselineIdentities }) {
  fs.mkdirSync(directory);
  const workspace = path.join(directory, 'workspace');
  fs.mkdirSync(workspace);
  for (const file of files) {
    const target = path.join(workspace, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(snapshot, file.path), target);
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(workspace, 'node_modules'), 'junction');
  const target = path.join(workspace, source);
  if (mutation) fs.writeFileSync(target, applyMutation(fs.readFileSync(target, 'utf8'), mutation));
  const result = { directory, sourceSha256: hash(fs.readFileSync(target)), mutation: mutation || null };
  const eventFile = path.join(directory, 'jest-events.jsonl');
  fs.writeFileSync(eventFile, '');
  const config = {
    rootDir: workspace, testMatch: ['**/*'],
    testEnvironment: path.join(__dirname, 'jest-evidence-environment.cjs'),
    testEnvironmentOptions: { evidencePath: eventFile },
    transform: { '^.+\\.tsx?$': [require.resolve('ts-jest'), {
      tsconfig: {
        target: 'ES2022', module: 'CommonJS', moduleResolution: 'Node',
        esModuleInterop: true, strict: true, skipLibCheck: true,
        types: ['node', 'jest'], typeRoots: [path.join(ROOT, 'node_modules/@types')],
      }, diagnostics: true,
    }] },
    cache: false, testTimeout: options.testTimeoutMs,
  };
  const configPath = path.join(directory, 'jest.config.json');
  writeJSON(configPath, config);
  const selectedTests = tests.map((file) => path.join(workspace, file));
  const commonArgs = [require.resolve('jest/bin/jest'), '--config', configPath,
    '--runInBand', '--runTestsByPath', ...selectedTests];
  const discovery = runCommand(process.execPath, [...commonArgs, '--listTests', '--json'], {
    cwd: workspace, timeoutMs: options.timeoutMs, prefix: path.join(directory, 'discovery'),
  });
  const discoveryFailure = processFailure(discovery);
  if (discoveryFailure) return { ...result, status: discoveryFailure, reason: 'Jest discovery failed' };
  let discovered;
  try { discovered = JSON.parse(discovery.stdoutText); } catch { /* fail closed below */ }
  if (discovery.exitCode !== 0 || !Array.isArray(discovered)) {
    return { ...result, status: 'infra-error', reason: 'Invalid Jest discovery output' };
  }
  if (discovered.length === 0) return { ...result, status: 'no-tests', reason: 'Jest discovered no selected tests' };
  if (JSON.stringify([...discovered].sort()) !== JSON.stringify([...selectedTests].sort())) {
    return { ...result, status: 'infra-error', reason: 'Jest discovery differs from explicit test selection' };
  }
  const compilation = runCommand(process.execPath, [path.join(__dirname, 'typecheck-fixture.js'),
    workspace, source, ...tests], {
    cwd: workspace, timeoutMs: options.timeoutMs, prefix: path.join(directory, 'typecheck'),
  });
  const compilationFailure = processFailure(compilation);
  if (compilationFailure) return { ...result, status: compilationFailure, reason: 'TypeScript worker failed' };
  let diagnostics;
  try { diagnostics = JSON.parse(compilation.stdoutText); } catch { /* fail closed below */ }
  if (compilation.exitCode === 1 && Array.isArray(diagnostics) && diagnostics.length > 0) {
    return { ...result, status: 'compile-error', diagnostics };
  }
  if (compilation.exitCode !== 0 || !Array.isArray(diagnostics) || diagnostics.length > 0) {
    return { ...result, status: 'infra-error', reason: 'Invalid TypeScript worker result' };
  }
  const reportFile = path.join(directory, 'jest-result.json');
  const execution = runCommand(process.execPath, [...commonArgs, '--json', '--outputFile', reportFile], {
    cwd: workspace, timeoutMs: options.timeoutMs, prefix: path.join(directory, 'jest'),
  });
  let report;
  try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch { /* fail closed */ }
  let events = null;
  try { events = fs.readFileSync(eventFile, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch { /* fail closed */ }
  return { ...result, ...classifyJest(execution, report, selectedTests, baselineIdentities, events) };
}

function runEvaluation(settings) {
  const project = fs.realpathSync(path.resolve(settings.project));
  const source = checkSelection(project, settings.source, 'source');
  const tests = (settings.tests || []).map((file) => checkSelection(project, file, 'test'));
  if (tests.length === 0 || new Set(tests).size !== tests.length || tests.includes(source) ||
      /(?:^|[/\\])__tests__(?:[/\\])|(?:[._-])(?:test|tests|spec)(?:[._-]|$)/i.test(source)) {
    throw new Error('Select one implementation source and distinct explicit test files; never mutate test files');
  }
  const options = { timeoutMs: 30000, testTimeoutMs: 5000, maxMutants: Infinity, ...settings };
  for (const key of ['timeoutMs', 'testTimeoutMs']) {
    if (!Number.isSafeInteger(options[key]) || options[key] <= 0) throw new Error(`${key} must be a positive integer`);
  }
  if (options.maxMutants !== Infinity && (!Number.isSafeInteger(options.maxMutants) || options.maxMutants <= 0)) {
    throw new Error('maxMutants must be a positive integer');
  }
  let output = path.resolve(settings.output || path.join(ROOT, 'eval/artifacts',
    `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`));
  if (within(path.join(ROOT, 'eval/results'), output) || within(output, project)) {
    throw new Error('Output cannot be inside historical results or an ancestor of the project');
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Jest canonicalizes rootDir. Match it on macOS (/var -> /private/var) too.
  output = path.join(fs.realpathSync(path.dirname(output)), path.basename(output));
  if (within(path.join(ROOT, 'eval/results'), output) || within(output, project)) {
    throw new Error('Output must be a new directory, outside historical eval/results and not an ancestor of the project');
  }
  fs.mkdirSync(output);
  const report = {
    schemaVersion: 2, purpose: 'fixture-mutation-check', startedAt: new Date().toISOString(),
    project, source, tests, output, settings: {
      timeoutMs: options.timeoutMs, testTimeoutMs: options.testTimeoutMs,
      maxMutants: Number.isFinite(options.maxMutants) ? options.maxMutants : null,
    },
    tools: { node: process.version, typescript: ts.version,
      jest: require('jest/package.json').version, tsJest: require('ts-jest/package.json').version },
    evidence: {
      packageLockSha256: hash(fs.readFileSync(path.join(ROOT, 'package-lock.json'))),
      runnerSha256: hash(fs.readFileSync(__filename)),
      typecheckerSha256: hash(fs.readFileSync(path.join(__dirname, 'typecheck-fixture.js'))),
      jestEnvironmentSha256: hash(fs.readFileSync(path.join(__dirname, 'jest-evidence-environment.cjs'))),
    }, status: 'running', baseline: null, mutations: [],
  };
  const save = () => writeJSON(path.join(output, 'report.json'), report);
  save();
  try {
    const files = inventory(project, output);
    report.inputs = files;
    const snapshot = path.join(output, 'inputs');
    fs.mkdirSync(snapshot);
    for (const file of files) {
      const destination = path.join(snapshot, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(project, file.path), destination);
      if (hash(fs.readFileSync(destination)) !== file.sha256) throw new Error('Input changed during snapshot');
    }
    report.baseline = runCase({ directory: path.join(output, 'baseline'), snapshot,
      files, source, tests, options });
    if (report.baseline.status !== 'passed') {
      report.status = 'baseline-failed';
      return report;
    }
    const candidates = generateMutations(fs.readFileSync(path.join(snapshot, source), 'utf8'), source);
    report.candidateCount = candidates.length;
    report.selectedCount = Math.min(candidates.length, options.maxMutants);
    for (const mutation of candidates.slice(0, options.maxMutants)) {
      const result = runCase({ directory: path.join(output, mutation.id), snapshot,
        files, source, tests, mutation, options, baselineIdentities: report.baseline.identities });
      if (result.status === 'failed') result.status = 'killed';
      else if (result.status === 'passed') result.status = 'survived';
      else if (result.status === 'no-tests') result.status = 'infra-error';
      report.mutations.push(result);
      save();
    }
    const counts = Object.fromEntries(STATUSES.map((status) => [status,
      report.mutations.filter((result) => result.status === status).length]));
    const scored = counts.killed + counts.survived;
    report.summary = {
      counts, scoredMutants: scored,
      excludedMutants: counts['compile-error'] + counts.timeout + counts['infra-error'],
      killRate: scored > 0 ? counts.killed / scored : null,
      interpretation: 'Describes only selected, executable fixture mutants; no causal plugin-effect inference.',
    };
    report.status = counts['infra-error'] || counts.timeout ? 'incomplete' : 'completed';
  } catch (error) {
    report.status = 'infra-error';
    report.error = error.stack || String(error);
  } finally {
    report.finishedAt = new Date().toISOString();
    save();
  }
  return report;
}

function main(args = process.argv.slice(2)) {
  const usage = 'Usage: node eval/scripts/mutation-test-runner.js --project DIR --source source.ts --test source.test.ts [--test another.test.ts] [--out NEW_DIR] [--max-mutants N] [--timeout-ms N] [--test-timeout-ms N]';
  if (args.includes('--help')) { console.log(usage); return 0; }
  const settings = { tests: [] };
  const keys = { '--project': 'project', '--source': 'source', '--out': 'output',
    '--max-mutants': 'maxMutants', '--timeout-ms': 'timeoutMs', '--test-timeout-ms': 'testTimeoutMs' };
  try {
    for (let index = 0; index < args.length; index += 2) {
      const flag = args[index];
      const value = args[index + 1];
      if (!value || value.startsWith('--') || (!keys[flag] && flag !== '--test')) throw new Error(usage);
      if (flag === '--test') settings.tests.push(value);
      else {
        const key = keys[flag];
        if (key in settings) throw new Error(`Duplicate option: ${flag}`);
        settings[key] = ['maxMutants', 'timeoutMs', 'testTimeoutMs'].includes(key) ? Number(value) : value;
      }
    }
    if (!settings.project || !settings.source) throw new Error(usage);
    const report = runEvaluation(settings);
    console.log(JSON.stringify({ status: report.status, baseline: report.baseline?.status,
      summary: report.summary, report: path.join(report.output, 'report.json') }, null, 2));
    return report.status === 'completed' ? 0 : 1;
  } catch (error) { console.error(error.message); return 1; }
}

module.exports = { generateMutations, applyMutation, runCommand, classifyJest, runEvaluation, main };
if (require.main === module) process.exitCode = main();
