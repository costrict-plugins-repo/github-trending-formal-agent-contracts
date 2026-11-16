# TaskManager reference example

## 日本語の説明

### この例は何か

タスク管理エージェントを題材にした、固定の参照例です。次のものが入っています。

- `TaskManager.vdmsl`：VDM-SL で書いた仕様
- `generated/task-manager.ts`：仕様から作った TypeScript 実装（実行時の契約チェックつき）
- `generated/test-task-manager.ts`：その実装を import して動かす、有限個のテスト
- `evidence/`：仕様とテストに対してツールを実行した記録（ログと `verification.json`）
- `smt/`、`seed-bug.patch`、`seed-bugs-both.patch`：手書きの SMT-LIB サンプルと、わざと欠陥を入れるためのパッチ
- `db/`：`generate-db-schema` スキルの出力例（スキーマ、仕様との乖離の記録、不変条件の担保箇所の対照表）

テストは実装そのものを import します。テストの中に別の実装はありません。テストがすべて通っても、実装があらゆる入力について仕様どおりに動くことが示されるわけではありません。

### テストの実行

リポジトリのルートで、次の2つのコマンドを実行します。Node.js 22 以上が必要です。Java は不要です。

```sh
npm ci --ignore-scripts
npm run test:example
```

`run-tests.cjs` が、固定した版の TypeScript で実装とテストを一時ディレクトリにコンパイルし、契約チェックを有効にして Node.js のテストランナーで実行します。コンパイルの失敗もテストの失敗も、0以外の終了コードになります。

### evidence/ の読み方

`evidence/` は、1つのスクリプトがまとめて作る記録です。件数などの数値は、この日本語の節には書き写しません（下の English details には、記録時点の値が書かれています。証跡を再生成したら、そちらも見直してください）。[evidence/verification.json](evidence/verification.json) を見てください（記録日は `recorded_on`、実行した環境とツールの版は `environment`）。

| 知りたいこと | ログ | `verification.json` の項目 |
|---|---|---|
| 仕様は構文チェック・型チェックを通ったか | `vdmj-po.txt` | `vdmj.syntax_type_check` |
| 証明責務（PO）はいくつ生成され、何が書かれているか | `vdmj-po.txt` | `vdmj.po_count` |
| 元の仕様で、QuickCheck は反例を見つけたか | `vdmj-qc.txt` | `vdmj.quickcheck` |
| 欠陥を仕込んだ仕様で、QuickCheck は何を返すか | `vdmj-qc-seeded-offbyone.txt`、`vdmj-qc-seeded-both.txt`（PO の一覧は `vdmj-po-seeded-*.txt`） | `seeded_variants` |
| 手書きの SMT サンプルに Z3 は何を返したか | `po8-state-init.txt`、`po27-changestatus-postcond.txt`、`po36-delete-postcond.txt` | `smt_checks` |
| 実装のテストは通ったか | `implementation-tests.txt` | `implementation_tests` |
| 確かめていないことは何か | （ログなし。一覧は右の項目） | `unverified` |

読むときの注意：

- PO は「生成された」だけです。`-p` は証明をしません。
- QuickCheck の `FAILED` は反例が見つかったこと、`MAYBE` は反例が見つからなかったことを表します。`MAYBE` は証明ではありません。`TIMEOUT` は PO ごとの時間切れで、マシンの負荷で内訳が変わります。
- 仕込みバグの記録は「欠陥があると、どう表示されるか」を見せるためのものです。パッチは仕様のコピーに当てます。
- SMT サンプルは手で書いた式で、確かめているのはその式だけです。ファイル名の PO 番号は過去のもので、現在の VDMJ の番号とは対応しません。
- どのログも、TypeScript 実装の正しさの証明ではありません。
- `verification.json` には入力ファイル（仕様、SMT サンプル、パッチ、実装、テスト、`run-tests.cjs`、`package.json`、`package-lock.json`）のハッシュが記録されています。どれかを変えた後は、記録は古いものとして扱い、再生成してください。

### 証跡の再生成

`evidence/` は [scripts/regenerate-example-evidence.mjs](../../scripts/regenerate-example-evidence.mjs) で作り直します。テストの実行と違い、こちらは Java（11 以上）、VDMJ（配布版のランチャー `vdmj.sh`）、Z3 が必要です。リポジトリのルートで実行します。

```sh
VDMJ_SH=/path/to/vdmj-suite-4.7.0/vdmj.sh Z3=z3 \
  node scripts/regenerate-example-evidence.mjs
```

スクリプトは、型チェックと PO の生成、QuickCheck（元の仕様と、欠陥を仕込んだ2つの変種）、Z3、実装のテストを順に実行し、ログと `verification.json` を書き出します。環境変数の詳細（`Z3_PYTHON`、`SKIP_QC`）は下の English details にあります。

### ファイル構成についての注記

この例は、実装を `generated/task-manager.ts` の1ファイルに、テストをその隣の `generated/test-task-manager.ts` に置いています。現在の `generate-code` スキルは `generated/` に `types.ts`、`contracts.ts`、`<module>.ts`、`index.ts` の4ファイルを書き、`generate-tests` スキルは（既存のテスト環境が無い場合）`tests/<module>.test.ts` を書きます（`<module>` は VDM-SL のモジュール名を kebab-case にしたもの。`TaskManager` なら `task-manager`）。この例はその構成になる前に作られたもので、作り直していません。作り直しは、[改善戦略](../../design/improvement-strategy-2026-10.md)の P6（generate-code の出力を、常に再生成するファイルと手で書くファイルに分ける変更）でこの例を再生成するときに行う予定です。それまで、この違いは残ります。

現在の構成の実物は [docs/onboarding-tests/2026-11-10-t1-vitest/](../../docs/onboarding-tests/2026-11-10-t1-vitest/) にあります。ただし、そちらは別の（もっと小さい）仕様から、エージェントによる模擬試行で生成されたもので、この例を作り直したものではありません。

## English details

This is a finite, reproducible regression baseline. The tests import
`generated/task-manager.ts`; they do not contain a second implementation.
Passing them does not establish that the implementation refines the VDM model
for every possible input.

## Run the implementation tests

From the repository root, using Node.js 22 or newer:

```sh
npm ci --ignore-scripts
npm run test:example
```

The runner compiles the implementation and tests with the locked TypeScript
version into a temporary directory, then runs Node's test runner with runtime
contracts enabled. Compilation failure or a failing test returns a nonzero exit
code. Temporary compiled files are removed afterwards.

The recorded baseline (see `recorded_on` in
[evidence/verification.json](evidence/verification.json)) has **22 passing test
cases**, covering CRUD, all nine status pairs, queries, invalid IDs, field
boundaries, invalid enum values, optional nonempty assignees, unchanged state
after rejected writes, and isolation of returned state. Several test cases contain multiple assertions.

## Representation limits

- VDM `nat1` is unbounded. This JavaScript example accepts only positive safe
  integers. Creating a task is rejected before mutation if advancing `nextId`
  would leave that range.
- Task records are frozen values. `board` returns a map snapshot and `nextId` is
  read-only; callers cannot bypass operations through these public accessors.
- String limits use JavaScript UTF-16 code units. Equivalence for all Unicode
  representations has not been established here.
- Operations are synchronous, in-memory examples. Persistence, distributed
  concurrency, transaction recovery and authentication are outside this example.
- VDM preconditions do not prescribe behavior for invalid calls. This adapter
  deliberately rejects them with `ContractError` before changing state; that
  behavior is an implementation choice checked by the regression tests.
- `VDM_CONTRACT_CHECK=off` opts out of the checks. A specification PO result does
  not justify disabling checks on the generated implementation or external input.

## Specification checks, QuickCheck and selected SMT samples

Everything under `evidence/` is produced by one script, which records the
environment that ran it (`environment` in `evidence/verification.json`):

```sh
# needs the VDMJ suite launcher (vdmj.sh), Java 11+, z3 and Node 22+
VDMJ_SH=/path/to/vdmj-suite-4.7.0/vdmj.sh Z3=z3 \
  node scripts/regenerate-example-evidence.mjs
```

Set `Z3_PYTHON` to a Python with `z3-solver` to also record the "assumptions
only" satisfiability check, and `SKIP_QC=1` to skip QuickCheck (about 2 minutes).
The individual steps, for running by hand:

```sh
vdmj.sh -vdmsl examples/task-manager/TaskManager.vdmsl -p          # type check + POs
vdmj.sh -vdmsl examples/task-manager/TaskManager.vdmsl -cmd "qc"   # QuickCheck
z3 -T:30 examples/task-manager/smt/po8-state-init.smt2             # one SMT sample
```

<!-- Link target: the root README.md and the iid2 site (getting-started page) link to this heading's anchor (#what-the-recorded-run-shows). If you rename the heading, update those links too. -->
### What the recorded run shows

The numbers below are those recorded in `evidence/verification.json`
(`recorded_on`, tool versions and host are in that file; re-run the script to
refresh them). PO counts and numbering are VDMJ-version-dependent.

- **Type check**: passed. The 8 `Warning 5000` unused-definition warnings are
  expected (log: `evidence/vdmj-po.txt`).
- **Proof obligations**: 37 generated, all `Unproved` by `-p` (that command only
  generates them).
- **QuickCheck on the clean spec**: `FAILED 0`. The split between `PROVABLE`,
  `MAYBE` and `TIMEOUT` is recorded in the json and varies with machine load
  (`TIMEOUT` is a per-PO time budget), so it is not asserted here
  (log: `evidence/vdmj-qc.txt`). `MAYBE` means no counterexample was found, not
  that the obligation is proved.
- **Seeded bugs**: two patches reintroduce defects that were fixed in commit
  `0045ff1`, to show what a failure looks like. Apply either to a *copy* of the
  spec (`patch -p1 <copy> -i <patch>`); the script does this automatically.

  | Patch | Defect | Recorded result |
  |---|---|---|
  | `seed-bug.patch` | CreateTask post-condition off-by-one (`RESULT = nextId~ - 1`) | 37 POs, **1 FAILED** with a counterexample at `nextId = 1` (log: `evidence/vdmj-qc-seeded-offbyone.txt`) |
  | `seed-bugs-both.patch` | the off-by-one plus a non-atomic board/nextId update | 38 POs, **2 FAILED** (log: `evidence/vdmj-qc-seeded-both.txt`) |

- **SMT samples**: the three hand-written files declare their expected verdict
  in a header comment; the script asserts it (`z3 -T:30`). All three returned
  `unsat`. This checks the submitted formulas only. The "assumptions only"
  check (all assertions except the final negated goal) returned `sat` for each,
  but note that `po8-state-init.smt2` contains a single assertion, so for that
  file the assumptions set is empty and the check is vacuous.

| Historical filename | Selected formula | Not established |
|---|---|---|
| `po8-state-init.smt2` | Empty-domain invariant with `nextId = 1` | Full model-to-encoding correspondence |
| `po27-changestatus-postcond.smt2` | Record update preserves title and sets status | Full map/state invariant and every source PO |
| `po36-delete-postcond.smt2` | Deleted key is absent from the encoded domain | Cardinality clause of the source postcondition |

The filenames retain old PO numbers for compatibility; they are **not a mapping
to the current VDMJ numbering**. None of these logs is a proof of the TypeScript
implementation. Regenerate evidence after input changes and compare hashes.
