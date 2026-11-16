#!/usr/bin/env node
// check-skill-vdmsl.mjs: re-check the VDM-SL shown in skills/ with VDMJ (Node >= 22, no dependencies).
//
// Collects every fenced code block tagged `vdm-sl`, `vdmsl` or `vdm` from skills/**/*.md and runs
// VDMJ's syntax check + type check on each block that can be checked on its own. Nothing else is
// run: no proof obligations, no QuickCheck, no interpreter. A pass means "VDMJ parsed and
// type-checked this text", not that the example is correct or proved.
//
// Fence rule: a block starts at an opening fence (3+ backticks or tildes) whose first info word
// is one of the tags above, and ends at the next bare fence of the same character and at least
// the same length (or at end of file). Other fences are not tracked, so a VDM-SL fence shown
// inside another block (for example inside a ```markdown template) is collected too.
//
// How a block is classified by its text:
//   module    The first non-comment line starts with `module <Name>` and the last non-comment
//             line is `end <Name>`. Checked exactly as written.
//   wrapped   The first non-comment line is a section header: `types`, `values`, `functions`,
//             `operations`, `traces`, or `state <Name> of`. Checked as
//               module SkillFragment exports all definitions <block> end SkillFragment
//             The block is checked alone: every name it uses must be defined inside it.
//   fragment  Anything else (definitions without a section header, bare expressions, a module
//             without its `end <Name>`, tool output). Counted as "not checked (fragment)" and
//             never handed to VDMJ. Add the section header to make such a block checkable.
//
// Opt-out marker: an HTML comment on the nearest non-blank line above the opening fence.
//   <!-- vdmsl-check: skip reason="deliberate counter-example: inv written as a separate definition" -->
//       The block is not checked. For counter-examples and schematic templates (`...`, placeholders).
//   <!-- vdmsl-check: syntax-only reason="uses Ticket and Action from the block above" -->
//       The block is parsed but type errors are ignored. For module/wrapped blocks that are
//       valid VDM-SL but use names defined elsewhere in the document.
// The reason is mandatory. A marker without a reason, with an unknown mode, not attached to a
// VDM-SL block, or asking for syntax-only on a `fragment` block is a "marker problem": it is
// reported, it fails the run, and it has no effect (the block is treated as if unmarked).
//
// Line numbers: each temporary file is padded so that every line of the block keeps the line
// number it has in the Markdown file. VDMJ's "at line N:C" therefore points into the .md file.
//
// Usage (from the repo root):
//   node scripts/check-skill-vdmsl.mjs [options] [path ...]
//     path        Markdown files or directories to scan instead of skills/ (repo-relative or absolute)
//     --require   exit 2 instead of 0 when VDMJ or Java is not available
//     --list      print every collected block with its classification and exit (never runs VDMJ)
//     --verbose   print every VDMJ error line of a failing block, and list the unchecked fragments
//     --keep      keep the temporary directory and print its path
//
// Environment variables (all optional):
//   VDMJ_SH     path to the VDMJ suite launcher (default: `vdmj.sh` on PATH)
//   JAVA_HOME   when $JAVA_HOME/bin/java exists, that directory is put first on the PATH given
//               to the launcher, and that java is the one reported
//
// Summary columns, per skill: blocks = checked + skipped-by-marker + not-checked-fragments;
// checked = passed + failed; (syntax-only) is the part of checked that a marker limited to the
// syntax check; marker-problems counts invalid markers and is independent of the block counts.
//
// Exit codes: 0 = every checked block passed and no marker problem, or VDMJ is not available
//                 (nothing was checked);
//             1 = at least one checked block failed, or there is a marker problem;
//             2 = --require was given and VDMJ or Java is not available, or bad arguments.
//
// Not part of `npm test` on purpose: the default test run must stay Java-free.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TARGETS = ['skills'];
const EXCLUDED_DIRS = new Set(['node_modules', '.git']);
const TAGS = new Set(['vdm-sl', 'vdmsl', 'vdm']);
const MARKER_MODES = new Set(['skip', 'syntax-only']);
const WRAPPER_MODULE = 'SkillFragment';
const VDMJ_SH = process.env.VDMJ_SH || 'vdmj.sh';
// -c / -t fix the file and console charsets, so the result does not depend on the caller's locale.
const VDMJ_ARGS = ['-vdmsl', '-c', 'UTF-8', '-t', 'UTF-8'];
const VDMJ_TIMEOUT_MS = 120_000;
const MAX_PARALLEL = 4;
const LINE_PREVIEW = 100;

const OPEN_FENCE = /^\s*(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/;
const BARE_FENCE = /^\s*(`{3,}|~{3,})\s*$/;
const MARKER = /^\s*<!--\s*vdmsl-check:\s*(\S*)(.*?)-->\s*$/;
const MARKER_REASON = /\breason\s*=\s*"([^"]*)"/;
const MODULE_START = /^module\s+[A-Za-z_][\w']*/;
const MODULE_END = /^end\s+[A-Za-z_][\w']*\s*;?$/;
const SECTION_START = /^(?:(?:types|values|functions|operations|traces)\b|state\s+[A-Za-z_][\w']*\s+of\b)/;

// ───────── collecting blocks ─────────

function listMarkdown(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      listMarkdown(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles(targets) {
  const files = [];
  for (const t of targets) {
    const full = isAbsolute(t) ? t : join(ROOT, t);
    if (!existsSync(full)) {
      console.error(`check-skill-vdmsl: no such file or directory: ${t}`);
      process.exit(2);
    }
    const st = statSync(full);
    if (st.isDirectory()) listMarkdown(full, files);
    else if (st.isFile() && full.endsWith('.md')) files.push(full);
  }
  return [...new Set(files.map((f) => resolve(f)))].sort();
}

// Repo-relative path with forward slashes; files outside the repo keep their absolute path.
function rel(file) {
  const r = relative(ROOT, file);
  return (r.startsWith('..') ? file : r).split(sep).join('/');
}

// Group name for the per-skill summary: .../skills/<name>/... -> <name>; anything else -> its directory.
function groupOf(path) {
  const parts = path.split('/');
  const i = parts.lastIndexOf('skills');
  if (i !== -1 && i + 2 < parts.length) return parts[i + 1];
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
}

// Lines that still carry VDM-SL tokens once `--` comments and /* ... */ comments are removed.
// Used only to classify a block; the text handed to VDMJ is never altered.
function significantLines(lines) {
  const out = [];
  let inBlockComment = false;
  for (const raw of lines) {
    let text = raw;
    if (inBlockComment) {
      const close = text.indexOf('*/');
      if (close === -1) continue;
      text = text.slice(close + 2);
      inBlockComment = false;
    }
    text = text.replace(/\/\*.*?\*\//g, ' ');
    const open = text.indexOf('/*');
    const dash = text.indexOf('--');
    if (open !== -1 && (dash === -1 || open < dash)) {
      text = text.slice(0, open);
      inBlockComment = true;
    } else if (dash !== -1) {
      text = text.slice(0, dash);
    }
    text = text.trim();
    if (text) out.push(text);
  }
  return out;
}

function classify(lines) {
  const sig = significantLines(lines);
  if (sig.length === 0) return { kind: 'fragment', first: '(no VDM-SL tokens)' };
  const first = sig[0];
  if (MODULE_START.test(first) && MODULE_END.test(sig[sig.length - 1])) return { kind: 'module', first };
  if (SECTION_START.test(first)) return { kind: 'wrapped', first };
  return { kind: 'fragment', first };
}

function parseMarker(text, line) {
  const m = MARKER.exec(text);
  if (!m) return null;
  const r = MARKER_REASON.exec(m[2]);
  return { line, mode: m[1], reason: r ? r[1].trim() : '' };
}

// The marker applies when it is the nearest non-blank line above the opening fence.
function markerAbove(lines, fenceIndex) {
  for (let i = fenceIndex - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') return parseMarker(lines[i], i + 1);
  }
  return null;
}

// What to do with a block: 'full' or 'syntax' (hand it to VDMJ), 'skip', or 'fragment'.
// An invalid marker has no effect: the block keeps the action its text gives it.
function decide(kind, marker) {
  const unmarked = { action: kind === 'fragment' ? 'fragment' : 'full' };
  if (!marker) return unmarked;
  if (!MARKER_MODES.has(marker.mode)) {
    return { ...unmarked, markerProblem: `unknown vdmsl-check mode '${marker.mode}' (known: ${[...MARKER_MODES].join(', ')})` };
  }
  if (!marker.reason) return { ...unmarked, markerProblem: 'vdmsl-check marker has no reason="..."' };
  if (marker.mode === 'skip') return { action: 'skip', reason: marker.reason };
  if (kind === 'fragment') {
    return { ...unmarked, markerProblem: 'syntax-only marker on a fragment that cannot be wrapped (start the block with a section header, or use skip)' };
  }
  return { action: 'syntax', reason: marker.reason };
}

function collectBlocks(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const path = rel(file);
  const group = groupOf(path);
  const blocks = [];
  const markerProblems = [];
  const usedMarkerLines = new Set();
  for (let i = 0; i < lines.length; i++) {
    const open = OPEN_FENCE.exec(lines[i]);
    if (!open || !TAGS.has(open[2].toLowerCase())) continue;
    const [, fence] = open;
    let end = i + 1;
    while (end < lines.length) {
      const close = BARE_FENCE.exec(lines[end]);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) break;
      end++;
    }
    const body = lines.slice(i + 1, end);
    const marker = markerAbove(lines, i);
    const shape = classify(body);
    const { markerProblem, ...decision } = decide(shape.kind, marker);
    if (marker) usedMarkerLines.add(marker.line);
    if (markerProblem) markerProblems.push({ path, group, line: marker.line, problem: `${markerProblem}; marker ignored for the block at line ${i + 1}` });
    blocks.push({ path, group, line: i + 1, body, ...shape, ...decision });
    i = end;
  }
  // A marker that no VDM-SL block picked up is a mistake worth reporting (text slipped in between).
  lines.forEach((text, i) => {
    if (!usedMarkerLines.has(i + 1) && parseMarker(text, i + 1)) {
      markerProblems.push({ path, group, line: i + 1, problem: 'vdmsl-check marker is not directly above a VDM-SL code block' });
    }
  });
  markerProblems.sort((a, b) => a.line - b.line);
  return { blocks, markerProblems };
}

// ───────── running VDMJ ─────────

function javaHomeBin() {
  const home = process.env.JAVA_HOME;
  return home && existsSync(join(home, 'bin', 'java')) ? join(home, 'bin') : null;
}

function childEnv() {
  const bin = javaHomeBin();
  return bin ? { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH || ''}` } : process.env;
}

function runSync(cmd, args, env) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env, timeout: VDMJ_TIMEOUT_MS });
  if (r.error) return { started: false, code: null, out: r.error.message };
  return { started: true, code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function firstLine(text) {
  return text.trim().split('\n')[0] || '';
}

// VDMJ needs both the launcher and a Java runtime; `<launcher> -v` exercises both.
function probeVdmj(env) {
  const v = runSync(VDMJ_SH, ['-v'], env);
  if (!v.started) return { ok: false, why: `launcher '${VDMJ_SH}' could not be started (${v.out})` };
  const m = v.out.match(/version\s*=\s*(.+)$/m);
  if (v.code !== 0 || !m) {
    return { ok: false, why: `'${VDMJ_SH} -v' did not report a VDMJ version (exit ${v.code}: ${firstLine(v.out) || 'no output'})` };
  }
  const bin = javaHomeBin();
  const j = runSync(bin ? join(bin, 'java') : 'java', ['-version'], env);
  const java = j.started && j.code === 0
    ? `${firstLine(j.out)}${bin ? ` (JAVA_HOME=${process.env.JAVA_HOME})` : ' (PATH)'}`
    : 'java chosen by the launcher itself (no java on PATH, JAVA_HOME not set)';
  return { ok: true, version: m[1].trim(), java };
}

// Pads the block so that its lines keep their Markdown line numbers (see header comment).
function vdmjInput(block) {
  const padding = '\n'.repeat(block.line - 1);
  const body = block.body.join('\n');
  if (block.kind === 'wrapped') {
    return `${padding}module ${WRAPPER_MODULE} exports all definitions\n${body}\nend ${WRAPPER_MODULE}\n`;
  }
  return `${padding}\n${body}\n`;
}

function tempName(block, index) {
  const slug = block.path.replace(/\.md$/, '').replace(/[^A-Za-z0-9]+/g, '-');
  return `${String(index + 1).padStart(3, '0')}-${slug}-L${block.line}.vdmsl`;
}

function runVdmj(dir, fileName, env) {
  return new Promise((done) => {
    const child = spawn(VDMJ_SH, [...VDMJ_ARGS, fileName], { cwd: dir, env });
    let out = '';
    const timer = setTimeout(() => {
      out += `\nVDMJ did not finish within ${VDMJ_TIMEOUT_MS / 1000}s; killed\n`;
      child.kill('SIGKILL');
    }, VDMJ_TIMEOUT_MS);
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (d) => { out += d; });
    }
    child.on('error', (e) => { clearTimeout(timer); done({ code: null, out: `${out}${e.message}` }); });
    child.on('close', (code) => { clearTimeout(timer); done({ code, out }); });
  });
}

async function checkBlock(block, index, dir, env) {
  const fileName = tempName(block, index);
  writeFileSync(join(dir, fileName), vdmjInput(block));
  const r = await runVdmj(dir, fileName, env);
  // VDMJ names the temporary file in its messages: drop the "(file)" suffix, which would only
  // repeat the path the report line starts with, and show the Markdown path anywhere else.
  const out = r.out.split(` (${fileName})`).join('').split(fileName).join(block.path);
  const syntaxOk = /No syntax errors/.test(out);
  const fullOk = r.code === 0 && syntaxOk && /No type errors/.test(out);
  block.passed = block.action === 'syntax' ? syntaxOk : fullOk;
  block.markerNotNeeded = block.action === 'syntax' && fullOk;
  block.errors = out.split('\n').filter((l) => /^Error \d+:/.test(l));
  if (!block.passed && block.errors.length === 0) {
    block.errors = [`VDMJ exit ${r.code}: ${firstLine(out) || 'no output'}`];
  }
}

async function runPool(items, limit, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(lanes);
}

// ───────── reporting ─────────

function preview(text) {
  return text.length > LINE_PREVIEW ? `${text.slice(0, LINE_PREVIEW)}…` : text;
}

const KIND_LABEL = { module: 'module', wrapped: 'wrapped fragment', fragment: 'fragment' };
const ACTION_LABEL = {
  full: 'syntax + type check',
  syntax: 'syntax check only (marker)',
  skip: 'skipped by marker',
  fragment: 'not checked (fragment)',
};

const isChecked = (b) => b.action === 'full' || b.action === 'syntax';

// `ran` is false for --list: the checked/passed/failed columns are then replaced by "checkable".
function summaryTable(blocks, markerProblems, ran) {
  const cols = [
    'blocks',
    ...(ran ? ['checked', 'passed', 'failed'] : ['checkable']),
    '(syntax-only)', 'skipped-by-marker', 'not-checked-fragments', 'marker-problems',
  ];
  const count = (list, problems) => {
    const checked = list.filter(isChecked);
    const n = (action) => list.filter((b) => b.action === action).length;
    return [
      list.length,
      ...(ran ? [checked.length, checked.filter((b) => b.passed).length, checked.filter((b) => !b.passed).length] : [checked.length]),
      n('syntax'), n('skip'), n('fragment'), problems.length,
    ];
  };
  const groups = [...new Set([...blocks, ...markerProblems].map((b) => b.group))].sort();
  const rows = groups.map((g) => [g, count(blocks.filter((b) => b.group === g), markerProblems.filter((p) => p.group === g))]);
  const nameWidth = Math.max(5, ...rows.map((r) => r[0].length));
  const line = (name, cells) => `${name.padEnd(nameWidth)}  ${cells.map((c, i) => String(c).padStart(cols[i].length)).join('  ')}`;
  const header = line('skill', cols);
  return [header, ...rows.map((r) => line(r[0], r[1])), '-'.repeat(header.length), line('total', count(blocks, markerProblems))].join('\n');
}

function parseArgs(argv) {
  const flags = new Set(['--require', '--list', '--verbose', '--keep']);
  const opts = { targets: [] };
  for (const a of argv) {
    if (flags.has(a)) opts[a.slice(2)] = true;
    else if (a.startsWith('--')) {
      console.error(`check-skill-vdmsl: unknown option ${a} (known: ${[...flags].join(' ')})`);
      process.exit(2);
    } else opts.targets.push(a);
  }
  if (opts.targets.length === 0) opts.targets = DEFAULT_TARGETS;
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = collectFiles(opts.targets);
  const collected = files.map(collectBlocks);
  const blocks = collected.flatMap((c) => c.blocks);
  const markerProblems = collected.flatMap((c) => c.markerProblems);
  const toCheck = blocks.filter(isChecked);
  const skipped = blocks.filter((b) => b.action === 'skip');
  const syntaxOnly = blocks.filter((b) => b.action === 'syntax');
  const fragments = blocks.filter((b) => b.action === 'fragment');
  const scope = `${blocks.length} VDM-SL block(s) in ${new Set(blocks.map((b) => b.path)).size} of ${files.length} Markdown file(s)`;
  const printMarkerProblems = () => {
    if (markerProblems.length === 0) return;
    console.log('\nmarker problems:');
    for (const p of markerProblems) console.log(`${p.path}:${p.line}: ${p.problem}`);
  };

  if (opts.list) {
    for (const b of blocks) {
      const why = b.reason ? ` reason="${b.reason}"` : '';
      console.log(`${b.path}:${b.line}: ${KIND_LABEL[b.kind]}: ${ACTION_LABEL[b.action]}${why}\n    ${preview(b.first)}`);
    }
    printMarkerProblems();
    console.log(`\n${summaryTable(blocks, markerProblems, false)}`);
    console.log(`\ncheck-skill-vdmsl: listed ${scope}; ${toCheck.length} checkable. VDMJ was not run (--list).`);
    return 0;
  }

  const env = childEnv();
  const probe = probeVdmj(env);
  if (!probe.ok) {
    console.log(`check-skill-vdmsl: skipped: VDMJ not available: ${probe.why}`);
    console.log(`check-skill-vdmsl: found ${scope}; ${toCheck.length} checkable, none checked.`);
    console.log('check-skill-vdmsl: to run the check, set VDMJ_SH to the VDMJ launcher (and JAVA_HOME if java is not on PATH).');
    if (opts.require) {
      console.log('check-skill-vdmsl: --require was given, so a skipped check is an error. FAIL');
      return 2;
    }
    return 0;
  }

  console.log(`check-skill-vdmsl: VDMJ ${probe.version} / ${probe.java}`);
  console.log(`check-skill-vdmsl: syntax + type check only (no proof obligations, no QuickCheck) on ${toCheck.length} of ${scope}`);

  const dir = mkdtempSync(join(tmpdir(), 'fac-skill-vdmsl-'));
  try {
    await runPool(toCheck, Math.min(MAX_PARALLEL, availableParallelism()), (b, i) => checkBlock(b, i, dir, env));
  } finally {
    if (opts.keep) console.log(`check-skill-vdmsl: temporary files kept in ${dir}`);
    else rmSync(dir, { recursive: true, force: true });
  }

  const failed = toCheck.filter((b) => !b.passed);
  if (failed.length > 0) console.log('\nfailing blocks:');
  for (const b of failed) {
    const more = !opts.verbose && b.errors.length > 1 ? ` (+${b.errors.length - 1} more error line(s), see --verbose)` : '';
    console.log(`${b.path}:${b.line}: ${KIND_LABEL[b.kind]}: ${b.errors[0]}${more}`);
    if (opts.verbose) for (const e of b.errors.slice(1)) console.log(`    ${e}`);
  }
  printMarkerProblems();

  if (skipped.length > 0) {
    console.log('\nskipped by marker (not checked):');
    for (const b of skipped) console.log(`${b.path}:${b.line}: ${b.reason}`);
  }
  if (syntaxOnly.length > 0) {
    console.log('\nsyntax check only, by marker (type errors ignored):');
    for (const b of syntaxOnly) {
      const note = b.markerNotNeeded ? '  [also passes the type check: the marker can be removed]' : '';
      console.log(`${b.path}:${b.line}: ${b.reason}${note}`);
    }
  }
  if (opts.verbose && fragments.length > 0) {
    console.log('\nnot checked (fragment):');
    for (const b of fragments) console.log(`${b.path}:${b.line}: ${preview(b.first)}`);
  }

  console.log(`\n${summaryTable(blocks, markerProblems, true)}`);

  const ok = failed.length === 0 && markerProblems.length === 0;
  const totals = `checked ${toCheck.length} (${syntaxOnly.length} syntax-only), passed ${toCheck.length - failed.length}, failed ${failed.length}, `
    + `skipped-by-marker ${skipped.length}, not-checked-fragments ${fragments.length}, marker-problems ${markerProblems.length}`;
  console.log(`\ncheck-skill-vdmsl: ${totals}. ${ok ? 'OK' : 'FAIL'}`);
  return ok ? 0 : 1;
}

process.exit(await main());
