---
name: generate-code
description: >
  Generate TypeScript/Python code scaffolds from VDM-SL specifications.
  Triggered by "generate code from the spec", "convert to TypeScript", "generate Python code",
  "create a scaffold", "generate implementation template", "create type definitions from VDM",
  or "generate agent code".
  Also responds to Japanese: 「仕様からコードを生成して」「TypeScriptに変換して」等。
  Generates runtime verification code for pre-conditions, post-conditions, and invariants.
metadata:
  version: "0.4.1"
---

# Code Generation from VDM-SL Specifications

Read VDM-SL specifications (types, functions, operations, invariants) and generate
TypeScript or Python implementation scaffolds. Includes runtime verification (pre/post/inv checks).

VDM-SL仕様を読み取り、TypeScript/Pythonの実装スキャフォールドを生成する。
ランタイム検証（pre/post/inv チェック）も含める。

## Verification boundary

Generated scaffolds are candidates, not verified refinements. Preserve all source
type constraints at runtime where the target type cannot express them (for
example integer/range checks for JavaScript `number` and nonempty optional
strings). Record every place where the target representation differs from the
VDM-SL value — bounded numbers, string length units, set/map equality by
identity, aliasing, and no rollback after a failed post-condition or invariant —
in two places: a JSDoc / docstring note on the affected declaration, and the
"Representation differences" item of the closing report. Tests must import the
generated implementation rather than duplicate it. Keep runtime checks enabled
by default; specification PO results alone do not establish that the generated
code or external inputs satisfy them.

Reporting rules (the ones from
[verification result rules](../verify-spec/references/verification-results.md)
that apply to this skill, repeated here so the skill can be used alone):

- Report only what was actually run: the command, its exit status and what it
  printed. Anything else is 「未実行」. Exit status 0 with no files checked or no
  tests executed is not a pass.
- Generating code, loading it without error, and later passing a finite set of
  tests are not machine verification of the spec. A VDMJ result about the spec
  says nothing about the generated code.
- A VDMJ result recorded for a different revision of the spec file is stale;
  treat it as not run.

仕様との表現上の差異（数値の範囲、文字列の長さの単位、集合・マップの同一性による比較、
エイリアス、事後条件・不変条件が失敗したときに状態を巻き戻さないこと）は、該当する宣言の
JSDoc と、完了報告の「仕様との表現上の差異」の両方に書く。報告するのは実際に実行した
コマンドとその結果だけで、それ以外は「未実行」と書く。

## Generation Flow

### Step 1: Read the Specification File

Read the `.vdmsl` file specified by the user.
If no file is specified, search for `.vdmsl` files in the workspace.

ユーザーが指定した `.vdmsl` ファイルを読み取る。指定がなければワークスペース内を探索。

### Step 2: Confirm Target Language

If the user hasn't specified, ask with AskUserQuestion:
- TypeScript
- Python
- Both

ユーザーが明示しない場合、AskUserQuestionで確認する。

### Step 2.5: Check for Model Routing (optional, token saving)

If a `model-routing.json` (produced by the `route-models` skill) exists next to the spec file:

- Process each module as a **separate subagent with the module's assigned model**
  (Claude Code: the Task tool's `model` parameter). Read the tier → model mapping
  from the routing file — never hard-code model names.
- Modules not listed in the file use `defaults.tier`.
- Verification is unchanged: generated code must pass the same gates as without
  routing. If a module's output fails its gate twice, escalate one tier,
  regenerate, append to `escalation.history`, and add the same row to the
  "Escalations" section of `MODEL-ROUTING.md`
  (see the `route-models` skill, `references/routing-rules.md`).
- If the runtime does not support per-subagent model selection, present the
  routing table as a recommendation and continue normally. Never fail the phase
  because routing is unavailable.

仕様ファイルの隣に `model-routing.json`（`route-models` スキルの成果物）があれば、
モジュールごとに割り当てモデルのサブエージェントで生成する（層→モデル対応は必ず
ファイルから読む）。検証はルーティング無しのときと同一で、同一モジュールが2回
失敗したら1層上げて再生成し、escalation.history と MODEL-ROUTING.md の両方に追記する。モデル指定が使えない環境では
推奨表の提示に留め、通常どおり進める。

### Step 2.7: Detect Project Conventions (TypeScript; before writing any file)

Read, do not assume: `package.json` (`type`, `dependencies` / `devDependencies`),
`tsconfig.json` (`compilerOptions.module`, `moduleResolution`,
`allowImportingTsExtensions`, `target`, `lib`, and `include` / `files` /
`rootDir`) and one or two existing `.ts` source or test files (how they write
relative imports). Choose the style of relative imports once, from the first
row that matches, and use it in every generated file:

| What you found | Relative imports in the generated code |
|---|---|
| No `tsconfig.json` and no existing TypeScript sources (for example an empty directory) | Default: explicit `.ts` extension (`./types.ts`) |
| Existing sources that import each other in one consistent style | The same style as the existing sources |
| `tsconfig.json` sets `allowImportingTsExtensions: true` | `.ts` extension |
| `tsconfig.json` without it, `module` / `moduleResolution` is `node16` or `nodenext` | `.js` extension (`./types.js`) |
| `tsconfig.json` without it, any other setting (`commonjs`, `bundler`, …) | No extension (`./types`) |

Erasable syntax and `import type` / `export type` apply in every row. Measured:
under ts-jest 29.4.15 with TypeScript 6.0.3 (`module: commonjs`, no
`allowImportingTsExtensions`) a `.ts`-extension import fails with TS5097 and the
extensionless form runs; the other rows are in the table of
`references/typescript-rules.md`.

Carry two more facts to the closing report when they apply:

- `package.json` has `"type": "commonjs"`, or the project compiles to CommonJS:
  `node <file>.ts` cannot load the generated ES-module files directly (measured:
  "Cannot use import statement outside a module"). They run through the
  project's own toolchain (ts-jest, `tsc`, a bundler).
- `tsconfig.json` `include` / `files` / `rootDir` does not cover
  `<spec dir>/generated/`: the project's type-check command will not read the
  generated files (see closing report item 3).

TypeScript の場合、ファイルを書く前に `package.json`・`tsconfig.json`・既存の `.ts` ファイルを
読み、相対 import の書き方を上の表の最初に当てはまる行で1つに決める（何も無ければ `.ts` 拡張子付き、
既存ソースがあればその書き方、`tsconfig.json` だけがある場合は `allowImportingTsExtensions` と
`module` の設定に従う）。`"type": "commonjs"` のプロジェクトでは `node <file>.ts` で直接実行できないこと、
`tsconfig.json` の `include` が `generated/` を含まない場合はプロジェクトの型チェックが生成ファイルを
読まないことを、完了報告に書く。

### Step 3: VDM-SL → Code Conversion

Follow the conversion rules in `references/typescript-rules.md` or `references/python-rules.md`.

`references/typescript-rules.md` または `references/python-rules.md` の変換ルールに従う。

Generated file structure:

**TypeScript:**
```
generated/
├── types.ts          -- Type definitions (interface/type)
├── contracts.ts      -- Pre/post/invariant verification functions
├── <module>.ts       -- Function/operation implementation scaffolds
└── index.ts          -- Exports
```

**Python:**
```
generated/
├── types.py          -- Type definitions (dataclass)
├── contracts.py      -- Pre/post/invariant verification functions
├── <module>.py       -- Function/operation implementation scaffolds
└── __init__.py       -- Exports
```

**Naming / 名前の付け方:**

- `<module>` is the VDM-SL module name: kebab-case for TypeScript
  (`TaskManager` → `task-manager.ts`, `UserDB` → `user-db.ts`), snake_case for
  Python (`task_manager.py`). `generate-tests` names its test file after the
  same name (`task-manager.test.ts`).
- A `state` definition becomes a class named after the **state**, not the
  module (`state TaskStore of` in module `TaskManager` → `class TaskStore` in
  `task-manager.ts`). Operations become its methods in camelCase.
- List the exported class and function names in the closing report, so the
  user does not have to guess which spelling to import.

`<module>` は VDM-SL のモジュール名を kebab-case にしたもの（Python は snake_case）。`state` は
状態名のクラスになる（モジュール名ではない）。export した名前は完了報告に挙げる。

### Step 4: Type Conversion

Convert VDM-SL types to target language types. See references for detailed rules.

VDM-SL型をターゲット言語の型に変換する。変換ルールの詳細はリファレンス参照。

Core mapping:

| VDM-SL | TypeScript | Python |
|--------|-----------|--------|
| `nat`, `nat1`, `int` | `number` | `int` |
| `real` | `number` | `float` |
| `bool` | `boolean` | `bool` |
| `seq of char` | `string` | `str` |
| `seq of T` | `T[]` | `list[T]` |
| `set of T` | `Set<T>` | `set[T]` |
| `map K to V` | `Map<K, V>` | `dict[K, V]` |
| Record type | `interface` | `@dataclass` |
| `[T]` (option) | `T \| null` | `Optional[T]` |
| Union type | union type | `Union[...]` |

### Step 5: Generate Contract Verification Code

Generate runtime check functions for invariants, pre-conditions, and post-conditions.

不変条件・事前条件・事後条件をランタイムチェック関数として生成する。

**Policy:**
- Type invariants → a validation function (`invT`) and a factory function
  (`mkT`). The factory always checks; `VDM_CONTRACT_CHECK` does not switch it off.
- Pre-conditions → assert/raise at function entry, before any state is changed,
  so that a rejected call leaves the state as it was.
- Post-conditions and state invariants → assert/raise at function exit. They
  are on by default like every other check; there is no separate debug mode.
- Old-state values in an operation post-condition (`x~`) → a snapshot taken
  before the body (see `references/typescript-rules.md`, Operation Conversion).
- `VDM_CONTRACT_CHECK`, one rule: checks are **on by default**. Setting
  `VDM_CONTRACT_CHECK=off` skips exactly the checks guarded by
  `contractsEnabled()`: pre-conditions, post-conditions and state invariants.
  With them off, a call that violates a pre-condition has no defined behaviour:
  it may succeed silently or fail with an unrelated error such as `TypeError`.
  Do not suggest `off` for running tests.

型の不変条件はファクトリ関数（`mkT`）で常にチェックする（`VDM_CONTRACT_CHECK` の対象外）。
事前条件は状態を変える前に、事後条件と状態不変条件は関数の出口でチェックする。いずれも既定で有効。
`VDM_CONTRACT_CHECK=off` が止めるのは `contractsEnabled()` で囲んだ事前条件・事後条件・状態不変条件だけで、
その状態で事前条件に違反する呼び出しをしたときの挙動は定義されない（黙って成功することも、`TypeError`
などの無関係なエラーになることもある）。

### Step 6: Generate Function/Operation Scaffolds

**Explicit definitions** → convert implementation where possible
**Implicit definitions (pre/post only)** → generate stubs with `TODO` comments

明示的定義 → 可能な範囲で実装を変換。暗黙的定義 → `TODO`付きスタブを生成。

```typescript
// VDM-SL: findUser(uid, users) == users(uid) pre uid in set dom users
export function findUser(uid: UserId, users: Map<UserId, User>): User {
  // Pre-condition check
  if (contractsEnabled()) {
    assert(users.has(uid), `Pre-condition failed: uid ${uid} not in dom users`);
  }

  // Implementation
  const result = users.get(uid)!;

  return result;
}
```

### Step 7: Output Files

Place generated code in a `generated/` subfolder in the same directory as the spec file.
If files already exist, ask the user for overwrite confirmation.
Write only the files listed in Step 3. Never delete, move or overwrite any other
file found in `generated/` (for example a `*.test.ts` that `generate-tests` or
the user placed there).

生成したコードを仕様ファイルと同じディレクトリの `generated/` に配置する。
ステップ3に挙げたファイル以外（`generated/` に置かれたテストファイルなど）は削除・上書きしない。

#### Closing report: How to run / 実行方法 (mandatory)

End the phase with this report. Every item is required. Fill it from the files
you actually wrote and from what you actually detected by reading
`package.json` and `tsconfig.json` (TypeScript) or `pyproject.toml` (Python) and
by running `node -v` / `python3 --version`. Do not assume that a `tsconfig.json`,
a `package.json`, `tsc` or a test runner exists, and do not report a command as
passing unless you ran it.

1. **Files written / 生成したファイル** — every path created or overwritten.
2. **Main exports and one call / 主な export と呼び出し例** — the names a caller
   imports (the state class and its methods, or the functions; `ContractError`),
   and from which file (`generated/index.ts`). Add two lines built from the real
   exports: one valid call, and one call that violates a pre-condition together
   with the error it raises (`ContractError` and the message text as written in
   the generated code). Say whether you ran these lines; do not present an
   error message you did not see as observed output. To run them before any
   test runner exists: when `node -p "process.features.typescript"` prints
   `strip`, the first `package.json` found from the spec directory upward (if
   any) does not set `"type": "commonjs"`, and the output uses `.ts`-extension
   imports, run one line per call from the spec directory, for example
   `node --input-type=module -e "import { UserDB } from './generated/index.ts'; try { new UserDB().removeUser(999); console.log('no error'); } catch (e) { console.log(e.name + ': ' + e.message); }"`
   (measured on Node.js v26.4.0: it prints the single line `ContractError: ...`
   when there is no `package.json` or it sets `"type": "module"`; when a
   `package.json` exists without a `"type"` field, Node.js prints a
   `MODULE_TYPELESS_PACKAGE_JSON` warning before that line; use the real export
   names). When these conditions do not hold and you did not run the lines
   another way, write 「未実行」.
3. **How to type-check or run / 型チェック・実行方法** — for the detected environment:
   - A toolchain exists (for TypeScript: `typescript` in `package.json` and a
     `tsconfig.json`): give the project's own type-check command and the
     directory to run it from. **First confirm that the command reads the
     generated files**: for `tsc`, `npx tsc --noEmit --listFilesOnly` must list
     paths under `generated/`. If `include` / `files` / `rootDir` leave them out
     (for example `"include": ["src"]` with `generated/` next to the spec), say
     so, and do not report that command's exit status as a check of the
     generated code: it exits 0 without reading them (measured). Give an
     explicit command instead, built from the project's own compiler options and
     the generated entry file. Read `npx tsc --version` first, because the flags
     differ by version. TypeScript 6 and later, for example:
     `npx tsc --noEmit --strict --target ES2020 --module commonjs --esModuleInterop --skipLibCheck --types node --ignoreConfig <dir>/generated/index.ts`.
     TypeScript 5.9: the same command without `--ignoreConfig`.
     On TypeScript 6 and later, passing files while a `tsconfig.json` exists
     stops with TS5112 unless `--ignoreConfig` is given, and `process` needs
     `--types node` (TS2591 otherwise); TypeScript 5.9 needs neither and rejects
     `--ignoreConfig` with TS5023 (measured on 5.9.3, 6.0.3 and 7.0.2). Do not
     edit the user's `tsconfig.json` to widen `include` unless asked. If you ran a command,
     report the command and its exit status; otherwise write 「未実行」.
   - No TypeScript toolchain (every other case: `typescript` is not in
     `package.json`, or there is no `tsconfig.json`; for example an empty
     directory with only Node.js, or a directory where only `npm init -y` was
     run): say so.
     State that the code needs no build step, that it runs under the test runner
     which `generate-tests` sets up in its Step 0, and that no type check was run.
     When the three conditions of item 2 hold (`node -p "process.features.typescript"`
     prints `strip`, the first `package.json` found from the spec directory
     upward does not set `"type": "commonjs"`, and the output uses
     `.ts`-extension imports), you may run
     `node <dir>/generated/index.ts` as a load check and report its exit status
     (0 means every module parsed and its imports resolved; it is not a type check).
     When one of them does not hold, do not run it and write 「未実行」 with the
     reason: under `"type": "commonjs"` (npm 11.17.0 writes that line in
     `npm init -y`) the command stops with a SyntaxError although the output is
     correct, and the same files pass under Vitest (measured).
     A type check is an optional follow-up that needs the `typescript` and
     `@types/node` packages; install them only if the user asks. The command is
     then `npx tsc --noEmit --allowImportingTsExtensions --strict --target es2022 --module nodenext --skipLibCheck --types node <dir>/generated/index.ts`
     (exit 0 on tsc 5.9.3, 6.0.3 and 7.0.2 for output that follows these rules).
4. **Contract checks / 契約チェック** — runtime checks are on by default. Setting
   `VDM_CONTRACT_CHECK=off` turns off the checks guarded by `contractsEnabled()`
   (pre-conditions, post-conditions, state invariants); type invariants in
   factory functions stay on. Keep the checks on when running tests.
5. **Representation differences / 仕様との表現上の差異** — the differences recorded
   in JSDoc (see Verification boundary), one line each, or 「なし」. Typical
   entries: integers are limited to the safe-integer range; `len` of a string
   counts UTF-16 code units, so a character outside the BMP (most emoji) counts
   as 2; `Set` / `Map` compare records by identity; state is not rolled back when
   a post-condition or state invariant fails after the body ran.
6. **TODO stubs / 手動実装が必要な箇所** — the count and the names
   (`file: function`) of every stub left with a `TODO`; write `0` when there are
   none. Tests that exercise a stub fail until it is implemented.
7. **Next prompt / 次のプロンプト** — 「契約テストを生成して」 (runs the
   `generate-tests` skill).
8. **Verification status / 検証の位置づけ** — always include this line: the code
   was derived from the spec by the LLM; generating it, and later passing a
   finite set of tests, is not machine verification of the spec. If no
   `verify-spec` (VDMJ) result exists next to the spec file or in this
   conversation, write 「仕様の機械検証（VDMJ）は未実行」 and name `verify-spec`
   as the optional next step, which needs Java. In a Japanese report, end with
   these two lines as written (the second one only when no `verify-spec` result
   exists), so that the wording matches `define-contract` and `generate-tests`:

   ```text
   - 位置づけ: このコードはLLMが仕様から導いたもので、生成できたこと、および後で有限個のテストに通ることは、仕様の機械検証ではない。
   - 仕様の機械検証（VDMJ）は未実行。必要なら verify-spec スキルで実行できる（任意。Javaが必要）。
   ```

フェーズの最後に必ずこの報告を出す：(1) 生成したファイルの一覧、(2) 主な export（状態クラスとメソッド、
関数、`ContractError`）と、正常な呼び出し1つ・事前条件に違反する呼び出し1つ（発生するエラーとメッセージ。
実行していなければそう書く）、(3) 実際に検出した環境での型チェック・実行方法（`tsconfig.json` や
`package.json` があると仮定しない。プロジェクトの型チェックコマンドを挙げる前に、それが `generated/` を
読むことを `npx tsc --noEmit --listFilesOnly` で確かめる。読まない場合は、そのコマンドの終了コードを
生成コードのチェック結果として報告せず、生成ファイルを明示したコマンドを示す。何も無ければ
「ビルド不要で、`generate-tests` がステップ0で用意するテストランナーで動く。型チェックは未実行」と書く）、
(4) `VDM_CONTRACT_CHECK` の切り替え（既定は有効、`off` で事前条件・事後条件・状態不変条件が無効。
ファクトリ関数の型不変条件は常に有効）、(5) 仕様との表現上の差異、(6) `TODO` スタブの件数と名前、
(7) 次のプロンプト「契約テストを生成して」、(8) 検証の位置づけ（LLMが仕様から導いたコードであり、
仕様の機械検証ではない。verify-spec の結果が無ければ「仕様の機械検証（VDMJ）は未実行」と書き、
任意の次のステップとして verify-spec（Javaが必要）を挙げる）。

## Generated Code Quality Guidelines

- Generated code should **load and run as written**, with no build step on the
  default path. Nothing on that path type-checks it: Node.js type stripping and
  Vitest only erase the types. Do not claim "no type errors" or "compiles"
  unless a type checker actually ran (`tsc`, or ts-jest, which type-checks the
  files it loads); the type check is the optional follow-up of closing report
  item 3.
- Use long-established library APIs in generated code
  (`Object.prototype.hasOwnProperty.call(o, k)`, not `Object.hasOwn(o, k)`): an
  existing project's `target` / `lib` can be older than the Node.js that runs it
  (measured: `Object.hasOwn` is TS2550 under `target: ES2020`).
- Mark locations requiring manual implementation with `TODO` comments
- Include the original VDM-SL definition in JSDoc / docstrings
- Contract violation error messages should be specific (which condition failed, with what value)
- **TypeScript: erasable syntax only** — in every project, including one whose
  own sources use these features (Step 2.7: "apply in every row"), do not emit
  `enum` (use a union of string literals), constructor
  parameter properties (declare the field and assign it in the constructor) or
  `namespace` (use ES modules). Node.js can then run the files directly by type
  stripping, with no build step; the zero-dependency path of `generate-tests`
  relies on this.
- **TypeScript: one import rule** — relative imports carry an explicit `.ts`
  extension (`./types.ts`), and types are imported and re-exported with
  `import type` / `export type`. Node.js type stripping requires both, Vitest
  resolves the same specifiers, and `tsc` accepts them once
  `allowImportingTsExtensions` is set together with `noEmit` (TS5097 otherwise).
  With this one rule the output works on every path of `generate-tests` Step 0
  (Vitest, Node.js built-in runner, files only). If the project already has
  TypeScript sources or a `tsconfig.json` that follow another import style,
  follow the project instead; Step 2.7 decides this before any file is written.
  Details and measurements: `references/typescript-rules.md`.

生成コードは、ビルドなしでそのまま読み込めて動く状態を目指す（既定の経路では誰も型チェックをしないので、
型チェッカーを実際に実行していない限り「型エラーなし」とは書かない）。`TODO`で手動実装箇所を明示。
JSDoc/docstringで元のVDM-SL定義を記載。エラーメッセージは具体的に。
TypeScriptは消去可能な構文のみ（`enum`・parameter properties・`namespace` を使わない。
既存プロジェクトがそれらを使っていても、生成コードでは使わない）。相対 import は `.ts` 拡張子付き、型は `import type`。
この1つの規則で `generate-tests` ステップ0の3つの選択肢すべてで動く。既存プロジェクトの TypeScript ソースや
`tsconfig.json` が別の import の書き方をしている場合は、ステップ2.7 で決めた書き方に従う（`.ts` 拡張子付きにしない）。

## Handling Unconvertible Syntax

The following constructs cannot be generated and should be noted with `TODO` comments:

以下はコード生成を断念し `TODO` コメントで注記する:

- Quantifiers bound over a **type** (`forall x : nat & ...`, `exists x : T & ...`)
  → describe semantics in comments. Quantifiers over a finite set, sequence or
  map domain are convertible (`every` / `some`; see the mapping table in
  `references/typescript-rules.md`).
- Pattern match exhaustiveness guarantees → suggest type guards only
- Map comprehension `{k |-> v | ...}` → convert to loop construction or `TODO`

State invariants are not in this list: generate them as a `checkInvariant()`
method that the constructor and every operation call (see
`references/typescript-rules.md`, Operation Conversion).

状態不変条件は変換できる（コンストラクタと各操作の最後で `checkInvariant()` を呼ぶ）。有限の集合・列・
マップの定義域に対する限量子も変換できる。型に対する限量子だけがコメントでの説明になる。

## Detailed References

- `references/typescript-rules.md` — Complete TypeScript conversion rules
- `references/python-rules.md` — Complete Python conversion rules
