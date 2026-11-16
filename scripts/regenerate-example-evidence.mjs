#!/usr/bin/env node
// Regenerate examples/task-manager/evidence/ from scratch and record provenance.
//
// Runs, in order:
//   1. VDMJ syntax/type check + PO generation on the clean spec
//   2. VDMJ QuickCheck on the clean spec
//   3. The same PO + QuickCheck runs on two seeded-bug variants (patches in examples/task-manager/)
//   4. z3 on the hand-written SMT samples (with -T:30), plus an "assumptions only" sanity check via z3py when available
//   5. The example's implementation tests (npm run test:example)
// and writes evidence/verification.json (schema_version 2) with the environment that produced the logs.
//
// Environment variables (all optional):
//   VDMJ_SH    path to the VDMJ suite launcher (default: `vdmj.sh` on PATH)
//   Z3         path to the z3 binary           (default: `z3` on PATH)
//   Z3_PYTHON  python interpreter with z3py     (default: skip the assumptions-only check)
//   SKIP_QC=1  skip QuickCheck (fast mode; QuickCheck fields are then recorded as "not-run")
//
// Usage (from the repo root):  node scripts/regenerate-example-evidence.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir, hostname, platform, release, arch } from 'node:os'
import { join, resolve, basename } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const EX = 'examples/task-manager'
const SPEC = `${EX}/TaskManager.vdmsl`
const EVID = `${EX}/evidence`
const VDMJ_SH = process.env.VDMJ_SH || 'vdmj.sh'
const Z3 = process.env.Z3 || 'z3'
const Z3_PYTHON = process.env.Z3_PYTHON || ''
const SKIP_QC = process.env.SKIP_QC === '1'

const abs = (p) => join(ROOT, p)
const sha256 = (p) => createHash('sha256').update(readFileSync(abs(p))).digest('hex')
const today = new Date().toISOString().slice(0, 10)

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
  if (r.error) throw new Error(`${cmd} failed to start: ${r.error.message}`)
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

function vdmjVersion() {
  const r = run(VDMJ_SH, ['-v'])
  // e.g. "VDMJ version = 4.7.0 build 260414"
  const m = r.out.match(/version\s*=\s*(.+)$/m)
  return m ? m[1].trim() : (r.out.trim().split('\n')[0] || 'unknown')
}

function javaVersion() {
  // vdmj.sh runs whatever `java` it finds; report JAVA_HOME's java when set, else the one on PATH.
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'
  const r = run(java, ['-version'])
  const first = r.out.trim().split('\n')[0] || ''
  return r.code === 0 ? `${first}${process.env.JAVA_HOME ? ` (JAVA_HOME=${process.env.JAVA_HOME})` : ' (PATH)'}` : `unknown (${first})`
}

function poCount(log) {
  const m = log.match(/Generated (\d+) proof obligations/)
  return m ? Number(m[1]) : null
}

function qcSummary(log) {
  const counts = { PROVABLE: 0, MAYBE: 0, FAILED: 0, TIMEOUT: 0 }
  const failed = []
  for (const line of log.split('\n')) {
    const m = line.match(/^PO #(\d+), (PROVABLE|MAYBE|FAILED|TIMEOUT)/)
    if (m) { counts[m[2]]++; if (m[2] === 'FAILED') failed.push(Number(m[1])) }
  }
  return { ...counts, failed_pos: failed }
}

function vdmjRuns(specPath, label) {
  const po = run(VDMJ_SH, ['-vdmsl', specPath, '-p'])
  const poLog = `${EVID}/vdmj-po${label}.txt`
  writeFileSync(abs(poLog), po.out)
  const result = {
    command: [basename(VDMJ_SH), '-vdmsl', specPath, '-p'],
    exit_code: po.code,
    syntax_type_check: /No syntax errors/.test(po.out) && /No type errors/.test(po.out) ? 'passed' : 'failed',
    po_count: poCount(po.out),
    log: poLog,
  }
  if (!SKIP_QC) {
    const qc = run(VDMJ_SH, ['-vdmsl', specPath, '-cmd', 'qc'])
    const qcLog = `${EVID}/vdmj-qc${label}.txt`
    writeFileSync(abs(qcLog), qc.out)
    result.quickcheck = { command: [basename(VDMJ_SH), '-vdmsl', specPath, '-cmd', 'qc'], exit_code: qc.code, ...qcSummary(qc.out), log: qcLog }
  } else {
    result.quickcheck = { status: 'not-run' }
  }
  return result
}

function seededVariant(name, patchFile, description) {
  const dir = join(tmpdir(), `fac-seed-${name}-${process.pid}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const tmpSpec = join(dir, 'TaskManager.vdmsl')
  writeFileSync(tmpSpec, readFileSync(abs(SPEC)))
  const p = run('patch', ['-p1', tmpSpec, '-i', abs(patchFile)])
  if (p.code !== 0) throw new Error(`patch ${patchFile} failed:\n${p.out}`)
  const r = vdmjRuns(tmpSpec, `-seeded-${name}`)
  // make the recorded command refer to the repo-relative recipe, not the temp path
  r.command = ['(apply', patchFile, 'to a copy of', SPEC, 'then)', ...r.command.map(a => a === tmpSpec ? '<copy>' : a)]
  if (r.quickcheck.command) r.quickcheck.command = r.quickcheck.command.map(a => a === tmpSpec ? '<copy>' : a)
  rmSync(dir, { recursive: true, force: true })
  return { name, patch: patchFile, patch_sha256: sha256(patchFile), description, ...r }
}

function z3Check(file) {
  const r = run(Z3, ['-T:30', file])
  const verdict = r.out.trim().split('\n')[0]
  let assumptions = 'not-run'
  if (Z3_PYTHON) {
    const py = `
import z3, sys
s = z3.Solver()
fs = z3.parse_smt2_file(sys.argv[1])
# drop the last assertion (the negated goal) and check the remaining assumptions are satisfiable
for f in list(fs)[:-1]:
    s.add(f)
print(s.check())
`
    const a = run(Z3_PYTHON, ['-c', py, abs(file)])
    assumptions = a.code === 0 ? a.out.trim() : `error: ${a.out.trim().split('\n').pop()}`
  }
  const log = `${EVID}/${basename(file, '.smt2')}.txt`
  writeFileSync(abs(log), `${verdict}\nAssumptions only (z3py, all assertions except final negated goal): ${assumptions}\n`)
  const expected = (readFileSync(abs(file), 'utf8').match(/Expected:\s*(unsat|sat)/i) || [])[1] || null
  return {
    subject: file,
    sha256: sha256(file),
    exit_code: r.code,
    raw_verdict: verdict,
    expected_verdict: expected,
    status: expected ? (verdict === expected ? 'passed' : 'failed') : 'recorded',
    scope: 'Submitted hand-written SMT formula only',
    source_correspondence: 'unverified',
    assumptions_status: assumptions,
    assumptions_scope: 'All asserted constraints except the final negated goal',
    log,
    command: [basename(Z3), '-T:30', file],
  }
}

function implementationTests() {
  const r = run('npm', ['run', 'test:example'])
  const log = `${EVID}/implementation-tests.txt`
  writeFileSync(abs(log), r.out)
  const passed = Number((r.out.match(/ℹ pass (\d+)/) || [])[1] || 0)
  const failed = Number((r.out.match(/ℹ fail (\d+)/) || [])[1] || 0)
  const inputs = [`${EX}/generated/task-manager.ts`, `${EX}/generated/test-task-manager.ts`, `${EX}/run-tests.cjs`, 'package.json', 'package-lock.json']
    .filter(p => existsSync(abs(p))).map(p => ({ path: p, sha256: sha256(p) }))
  return {
    command: ['npm', 'run', 'test:example'],
    node: process.version,
    typescript: JSON.parse(readFileSync(abs('package.json'), 'utf8')).devDependencies?.typescript || null,
    exit_code: r.code,
    passed, failed,
    status: r.code === 0 && failed === 0 ? 'passed' : 'failed',
    scope: 'Finite Node test cases importing shipped TaskManager implementation',
    log,
    inputs,
  }
}

// ───────── main ─────────
mkdirSync(abs(EVID), { recursive: true })
const vdmjVer = vdmjVersion()
const javaVer = javaVersion()
const z3Ver = run(Z3, ['--version']).out.trim()

const clean = vdmjRuns(SPEC, '')
const seeded = [
  seededVariant('offbyone', `${EX}/seed-bug.patch`, 'CreateTask post-condition off-by-one only (RESULT = nextId~ - 1). The variant shown in the LT slides / Zenn article.'),
  seededVariant('both', `${EX}/seed-bugs-both.patch`, 'Both bugs fixed in commit 0045ff1: the off-by-one above plus the non-atomic board/nextId update (intermediate state violates the state invariant).'),
]
const smt = ['po27-changestatus-postcond', 'po36-delete-postcond', 'po8-state-init'].map(n => z3Check(`${EX}/smt/${n}.smt2`))
const impl = implementationTests()

const out = {
  schema_version: 2,
  recorded_on: today,
  generated_by: 'scripts/regenerate-example-evidence.mjs',
  environment: {
    host: `${hostname()} (${platform()} ${release()}, ${arch()})`,
    note: 'Author machine. Tools installed user-locally under ~/.vdmj (Temurin JDK tarball, VDMJ suite zip, z3 via pip venv). Re-run with the same script on a clean container to cross-check.',
    java: javaVer,
    vdmj: vdmjVer,
    vdmj_launcher: VDMJ_SH,
    z3: z3Ver,
    node: process.version,
  },
  spec: { path: SPEC, sha256: sha256(SPEC) },
  vdmj: { version: vdmjVer, ...clean },
  seeded_variants: seeded,
  z3_version: z3Ver,
  smt_checks: smt,
  unverified: [
    'Semantic correspondence of hand-written SMT samples to full VDMJ POs',
    'Implementation refinement and universal correctness',
    'Business requirement completeness',
    'QuickCheck MAYBE/TIMEOUT obligations are neither proved nor refuted',
  ],
  implementation_tests: impl,
}
writeFileSync(abs(`${EVID}/verification.json`), JSON.stringify(out, null, 2) + '\n')

console.log(`spec ${SPEC} sha256 ${out.spec.sha256.slice(0, 12)}…`)
console.log(`VDMJ ${vdmjVer} / ${javaVer}`)
console.log(`clean: type check ${clean.syntax_type_check}, ${clean.po_count} POs, QuickCheck ${JSON.stringify(clean.quickcheck.status || { PROVABLE: clean.quickcheck.PROVABLE, MAYBE: clean.quickcheck.MAYBE, TIMEOUT: clean.quickcheck.TIMEOUT, FAILED: clean.quickcheck.FAILED })}`)
for (const s of seeded) console.log(`seeded ${s.name}: ${s.po_count} POs, FAILED ${s.quickcheck.FAILED ?? '-'} ${JSON.stringify(s.quickcheck.failed_pos || [])}`)
for (const c of smt) console.log(`z3 ${basename(c.subject)}: ${c.raw_verdict} (expected ${c.expected_verdict}) ${c.status}; assumptions ${c.assumptions_status}`)
console.log(`implementation tests: ${impl.passed} passed, ${impl.failed} failed (${impl.status})`)
console.log(`wrote ${EVID}/verification.json`)
process.exit(clean.syntax_type_check === 'passed' && impl.status === 'passed' && smt.every(c => c.status !== 'failed') ? 0 : 1)
