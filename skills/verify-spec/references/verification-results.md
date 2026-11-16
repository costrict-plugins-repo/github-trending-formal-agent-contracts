# Recording verification evidence

Use these rules when reporting checks or passing their results to another skill.
The result belongs to a specific input and check; it is not a global certification.

| Check | What a successful result establishes | What remains separate |
|---|---|---|
| Specification writing | A candidate contract has been expressed | Requirement completeness, consistency, stakeholder intent |
| VDMJ syntax/type checks | The supplied model passes these checks | All invariants, satisfiability, all POs, implementation correctness |
| PO generation | The tool generated the listed obligations | Discharge of each obligation; `Unproved` stays unproved |
| SMT solving | A result about the submitted formula and assumptions | Semantic correspondence to the source PO and implementation |
| Implementation tests | Listed finite executions passed | Unexecuted cases and general correctness |
| Document review | Listed items were inspected | Machine verification and completeness of all requirements |

## Evidence record

For every executed check, record the following in the result document (or a
`verification.json` with one entry per check). The fields are minimum content,
not a fixed layout. A grouped example ships with this plugin at
`examples/task-manager/evidence/verification.json`, counted from the plugin's
root directory (from this file: `../../../examples/task-manager/evidence/verification.json`).
Save command output as log files next to the spec (the `verify-spec` skill uses
an `evidence/` directory; its command reference shows the redirect form):

- `kind`, `subject`, relevant requirement/clause/PO IDs.
- Input file paths and SHA-256 hashes; code revision when available.
- Tool name and version, command, exit code, and log paths.
- `status`: `passed`, `failed`, `not-run`, `unsupported`, `unknown`, `timeout`,
  or `error`. Use `error` for tool startup, parser, configuration and other
  execution problems. Preserve the raw tool verdict separately.
- `scope`, `assumptions`, and `unverified`: the exact checked property and its limits.
- For SMT: source PO, translation file/hash, translation method and review status,
  asserted assumptions, and any model/unknown reason.

These fields describe a reporting convention; they are not a claimed existing
automatic schema validator. If evidence is unavailable, say so instead of filling
it with an invented command, version, count, or success value. Historical output
whose input hashes do not match the current files is stale.

## Interpreting execution

1. Check exit status **and** stdout/stderr. VDMJ can print errors during PO
   processing even when the process exits zero. Zero exit status alone is not a pass.
2. PO generation success never changes `Unproved` into proved. A readable proof
   sketch or an LLM's confidence is a review comment, not a tool result.
3. A single finite witness may show a predicate can be satisfied. It does not
   establish that every state transition preserves it or that all required
   behavior is specified.
4. For Z3, report `unsat` as validity of the **translated formula under recorded
   assumptions**. An inconsistent asserted context must be reported explicitly.
   Report `sat` as a translated counterexample candidate and validate its mapping
   to the original specification. `unknown` means this run did not decide; record
   the reason. It is not itself a proof of mathematical undecidability.
5. A test run needs discovered/executed tests and usable results. No tests, build
   failures, unavailable tools, and timeouts do not count as successful testing
   or mutation kills. A mutation score requires a passing original baseline.
6. Keep runtime checks enabled by default. Proving a specification PO does not
   establish that translated/generated code or untrusted inputs meet it.

日本語の結果でも「記述済み」「構文・型検査済み」「PO生成済み」「翻訳命題の結果」
「実装の有限テスト」「文書レビュー」を分ける。「検証済み」「保証」とだけ書かず、
対象・仮定・実行証拠・未確認範囲を併記する。
