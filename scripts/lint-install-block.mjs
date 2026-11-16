#!/usr/bin/env node
// lint-install-block.mjs: one canonical install block, copied verbatim everywhere.
//
// The canonical block lives in README.md between
//   <!-- install-block:start -->  and  <!-- install-block:end -->
// and must contain exactly four `/plugin ...` command lines:
//   1-2  community marketplace route (shown first)
//   3-4  this repository as a marketplace (the "latest" route)
//
// Every other surface that prints an install command must use those commands
// character for character (after whitespace normalisation):
//   - Markdown under docs/, skills/ and prompt-templates.md in this repo
//   - the companion site's dictionaries (iid2: src/dictionaries/{en,ja}.json),
//     compared after JSON.parse, so JSON escaping does not matter
//
// The site checkout is looked up at $IID2_DIR, then ../iid2. When it is not
// there (for example on CI) the site check is skipped with a notice and the
// run still passes or fails on the in-repo surfaces alone.
//
// Usage:  node scripts/lint-install-block.mjs   (exit 1 on any mismatch)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(ROOT, 'README.md');
const START = '<!-- install-block:start -->';
const END = '<!-- install-block:end -->';
const MD_TARGETS = ['docs', 'skills', 'prompt-templates.md'];
// Surfaces that must carry the community route in full (not merely avoid wrong commands).
const MUST_HAVE_COMMUNITY = ['docs/zenn/formal-layer-of-sdd.md', 'docs/lt-ai-driven-dev/slides.md'];
const COMMAND = /\/plugin (?:marketplace add|install) [^\s`"'<>）)、。]+/g;

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const problems = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

// ── canonical block ───────────────────────────────────────────────
const readme = readFileSync(README, 'utf8');
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a < 0 || b < 0 || b < a) {
  console.error(`lint-install-block: README.md has no ${START} … ${END} block`);
  process.exit(1);
}
const canonical = readme.slice(a, b).split('\n').map(norm).filter((l) => l.startsWith('/plugin '));
if (canonical.length !== 4) {
  console.error(`lint-install-block: expected 4 /plugin command lines in the README block, found ${canonical.length}`);
  process.exit(1);
}
const community = canonical.slice(0, 2);
const latest = canonical.slice(2, 4);
if (!/^\/plugin marketplace add /.test(community[0]) || !/^\/plugin install /.test(community[1]) ||
    !/^\/plugin marketplace add /.test(latest[0]) || !/^\/plugin install /.test(latest[1])) {
  console.error('lint-install-block: README block must be two (marketplace add, install) pairs, community route first');
  process.exit(1);
}
const allowed = new Set(canonical);

// README itself: no install command outside the block may differ from it.
for (const m of (readme.slice(0, a) + readme.slice(b)).matchAll(COMMAND)) {
  if (!allowed.has(norm(m[0]))) fail('README.md', `command outside the canonical block is not canonical: ${m[0]}`);
}

// ── Markdown surfaces in this repo ────────────────────────────────
function listMarkdown(path, out) {
  if (!existsSync(path)) return out;
  if (path.endsWith('.md')) { out.push(path); return out; }
  for (const e of readdirSync(path, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = join(path, e.name);
    if (e.isDirectory()) listMarkdown(full, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
  return out;
}
const mdFiles = MD_TARGETS.flatMap((t) => listMarkdown(join(ROOT, t), []));
let mdWithCommands = 0;
for (const file of mdFiles) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  const found = [...text.matchAll(COMMAND)].map((m) => norm(m[0]));
  if (found.length) mdWithCommands++;
  for (const cmd of found) if (!allowed.has(cmd)) fail(rel, `not a canonical install command: ${cmd}`);
  if (MUST_HAVE_COMMUNITY.includes(rel)) {
    const lines = text.split('\n').map(norm);
    const i = lines.indexOf(community[0]);
    if (i < 0 || lines[i + 1] !== community[1]) fail(rel, 'community route must appear as the two canonical lines, consecutively');
  }
}
for (const rel of MUST_HAVE_COMMUNITY) if (!existsSync(join(ROOT, rel))) fail(rel, 'expected surface is missing');

// ── companion site dictionaries ───────────────────────────────────
const siteCandidates = [process.env.IID2_DIR, resolve(ROOT, '..', 'iid2')].filter(Boolean);
const site = siteCandidates.find((d) => existsSync(join(d, 'src', 'dictionaries', 'ja.json')));
let siteNote = 'site: skipped (no iid2 checkout at $IID2_DIR or ../iid2)';
if (site) {
  let strings = 0;
  for (const name of ['en.json', 'ja.json']) {
    const dict = JSON.parse(readFileSync(join(site, 'src', 'dictionaries', name), 'utf8'));
    const pairs = { community: 0, latest: 0 };
    (function walk(v, path) {
      if (typeof v === 'string') {
        const cmds = [...v.matchAll(COMMAND)].map((m) => norm(m[0]));
        if (!cmds.length) return;
        strings++;
        for (const cmd of cmds) if (!allowed.has(cmd)) fail(`iid2 ${name} ${path}`, `not a canonical install command: ${cmd}`);
        // A value that is nothing but command lines must be exactly one canonical pair.
        const lines = v.split('\n').map(norm).filter(Boolean);
        if (lines.every((l) => l.startsWith('/plugin '))) {
          const joined = lines.join('\n');
          if (joined === community.join('\n')) pairs.community++;
          else if (joined === latest.join('\n')) pairs.latest++;
          else fail(`iid2 ${name} ${path}`, 'command-only value is neither the community pair nor the latest pair');
        }
      } else if (v && typeof v === 'object') {
        for (const [k, child] of Object.entries(v)) walk(child, path ? `${path}.${k}` : k);
      }
    })(dict, '');
    if (pairs.community === 0) fail(`iid2 ${name}`, 'no value carries the community install pair');
  }
  siteNote = `site: ${relative(ROOT, site) || site} checked (${strings} string(s) with install commands)`;
}

if (problems.length) {
  console.error(`lint-install-block: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('Canonical commands (README.md):');
  for (const c of canonical) console.error(`  ${c}`);
  process.exit(1);
}
console.log(`lint-install-block: OK (${mdWithCommands} Markdown file(s) with install commands; ${siteNote})`);
