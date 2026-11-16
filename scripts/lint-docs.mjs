#!/usr/bin/env node
// lint-docs.mjs: grep-only documentation lint (Node >= 22, no dependencies).
//
// Scans skills/, README.md and docs/ (recursively, *.md only; scripts/ and eval/
// are never scanned) for wording that the P1 cleanup removed and must not come
// back, and checks that every "N skills" / 「Nスキル」 mention agrees with the
// number of directories under skills/.
//
// Usage:
//   node scripts/lint-docs.mjs          # exit 1 on any non-allowed hit
//   node scripts/lint-docs.mjs --list   # print the forbidden patterns and exit 0
//
// Allow-list: eval/lint-docs.allow, one `path:line` per line (repo-relative),
// `#` starts a comment. A hit on an allow-listed path:line is reported as
// "allowed" and does not fail the run.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW_FILE = join(ROOT, 'eval', 'lint-docs.allow');
const SCAN_TARGETS = ['skills', 'README.md', 'docs'];
const EXCLUDED_DIRS = new Set(['scripts', 'eval', 'node_modules', '.git']);
const SKILLS_DIR = join(ROOT, 'skills');
const SKILL_COUNT_TARGETS = ['README.md', 'docs'];
const MIN_FLAGGED_SKILL_COUNT = 10;
const LINE_PREVIEW = 120;

// Forbidden patterns: [regex, short reason]
const FORBIDDEN = [
  [/\bold (?!state\b)[a-z]/, 'old-state must be written as x~ (VDM-SL has no `old`)'],
  [/\bpost .*\bresult\b/, 'postcondition result must be RESULT'],
  [/後提条件/, 'typo: use 事後条件'],
  [/Record type used in set/, 'false VDM-SL rule (set of <Record> is valid)'],
  [/imports all from Prelude/, 'invalid VDM-SL syntax (no Prelude module)'],
  [/vdmj-4\.7\.0\.jar/, 'hard-coded VDMJ jar name; use the distribution launcher vdmj.sh (skills/verify-spec/references/vdmj-setup.md)'],
  [/スキル設定/, 'non-existent "skill settings" feature'],
  [/13スキル|13 skills/, 'stale skill count (13); see `ls skills | wc -l`'],
  [/自然と検出される/, 'unsupported causal claim removed from eval report'],
  [/コードの振る舞いで評価/, 'misleading eval claim (control group was seeded)'],
  [/\+42\.8p[pt]/, 'retracted M2 delta (+42.8pp) from eval report'],
  [/\+20\.3pp/, 'retracted M6 delta (+20.3pp) from eval report'],
  [/PROVABLE 16/, 'QuickCheck figures without recorded provenance'],
];

const SKILL_COUNT_PATTERNS = [
  /全?(\d+)\s*スキル/g,
  /\b(\d+)\s+skills\b/gi,
];

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
    const full = join(ROOT, t);
    if (!existsSync(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) listMarkdown(full, files);
    else if (st.isFile() && full.endsWith('.md')) files.push(full);
  }
  return files.sort();
}

function loadAllowList() {
  const allowed = new Set();
  if (!existsSync(ALLOW_FILE)) return allowed;
  for (const raw of readFileSync(ALLOW_FILE, 'utf8').split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^(.+):(\d+)$/.exec(line);
    if (!m) {
      console.error(`lint-docs: malformed allow-list entry: ${raw.trim()}`);
      process.exit(2);
    }
    allowed.add(`${m[1].split('/').join(sep)}:${m[2]}`);
  }
  return allowed;
}

function countSkills() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
}

function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

function preview(line) {
  const t = line.trim();
  return t.length > LINE_PREVIEW ? `${t.slice(0, LINE_PREVIEW)}…` : t;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--list')) {
    for (const [re, reason] of FORBIDDEN) console.log(`${re.source}\t${reason}`);
    console.log(`skill-count\tREADME.md/docs/**/*.md must agree with \`ls skills | wc -l\` (N >= ${MIN_FLAGGED_SKILL_COUNT})`);
    return 0;
  }

  const allowed = loadAllowList();
  const hits = [];
  const allowedHits = [];
  const skillCount = countSkills();

  const record = (file, lineNo, reason, text) => {
    const key = `${relative(ROOT, file)}:${lineNo}`;
    const entry = { path: rel(file), line: lineNo, reason, text: preview(text) };
    (allowed.has(key) ? allowedHits : hits).push(entry);
  };

  const skillCountFiles = new Set(collectFiles(SKILL_COUNT_TARGETS));
  for (const file of collectFiles(SCAN_TARGETS)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      for (const [re, reason] of FORBIDDEN) {
        if (re.test(text)) record(file, i + 1, `${re.source}: ${reason}`, text);
      }
      if (skillCountFiles.has(file)) {
        for (const re of SKILL_COUNT_PATTERNS) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(text)) !== null) {
            const n = Number(m[1]);
            if (n >= MIN_FLAGGED_SKILL_COUNT && n !== skillCount) {
              record(file, i + 1, `skill-count: says ${n}, skills/ has ${skillCount}`, text);
            }
          }
        }
      }
    });
  }

  for (const h of allowedHits) {
    console.log(`${h.path}:${h.line}: allowed: ${h.reason}\n    ${h.text}`);
  }
  for (const h of hits) {
    console.log(`${h.path}:${h.line}: ${h.reason}\n    ${h.text}`);
  }

  if (hits.length > 0) {
    const files = new Set(hits.map((h) => h.path));
    console.log(`\nlint-docs: ${hits.length} hit(s) in ${files.size} file(s), ${allowedHits.length} allowed. FAIL`);
    return 1;
  }
  console.log(`lint-docs: OK (${skillCount} skills, ${allowedHits.length} allow-listed hit(s), 0 violations)`);
  return 0;
}

process.exit(main());
