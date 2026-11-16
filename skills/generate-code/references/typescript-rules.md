# VDM-SL → TypeScript Conversion Rules / VDM-SL → TypeScript 変換ルール

## Module and Syntax Rules / モジュールと構文の規則

These rules keep the output usable without a build step in three ways: under
Vitest, under Node.js's built-in test runner (type stripping), and as plain files
the user wires up later. Erasable syntax and `import type` / `export type` apply
in every project. The `.ts` import extension is the default: when the project
already has TypeScript sources or a `tsconfig.json` that follow another import
style, follow the project for the extension (`../SKILL.md` Step 2.7 decides the
import style before any file is written). "Measured" below means observed with Node.js v26.4.0, Vitest 5.1.0 and
tsc 5.9.3; rows that name TypeScript 6 or ts-jest were measured with TypeScript
6.0.3, Jest 30.5.2 and ts-jest 29.4.15, and rows that name 7.0.2 were also
measured with TypeScript 7.0.2. "Documented" means stated in the Node.js
documentation.

消去可能な構文と `import type` / `export type` は、どのプロジェクトでも守る。相対 import の拡張子だけは、
既存プロジェクトに別の書き方があればそちらに従う（`../SKILL.md` のステップ2.7）。Vitest・Node.js 組み込みテストランナー
（型ストリッピング）・ファイルのみ、のどの使い方でもビルドなしで動かすための規則。

### Erasable Syntax Only / 消去可能な構文のみ

| Do not emit / 使わない | Emit instead / 代わりに |
|---|---|
| `enum`, `const enum` | Union of string literals (see Quote Types below) / 文字列リテラルのユニオン |
| Constructor parameter properties (`constructor(private x: number)`) | Declared field plus assignment in the constructor / フィールド宣言とコンストラクタ内の代入 |
| `namespace` blocks | ES modules (`export` / `import`) |
| Import aliases (`import x = ...`), decorators | ES `import`, plain functions |

Node.js rejects the first three rows with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`
(measured); the fourth row is documented. Type annotations, `interface`, `type`,
generics, `as`, `!`, `satisfies`, `private` / `readonly` on declared fields and
`asserts` return types are erased and run as-is (measured).

### Imports and Exports / import と export

- Use ES modules, and export every type, invariant function, factory function
  and state class that the spec defines, so that tests can import them.
  / 仕様が定義する型・不変条件関数・ファクトリ関数・状態クラスはすべて export する。
- Relative imports carry an explicit `.ts` extension. / 相対 import には `.ts` 拡張子を付ける。
- Import and re-export types with `import type` / `export type` (or the inline
  `type` modifier). / 型は `import type` / `export type` で書く。

```typescript
// <module>.ts — the VDM-SL module name in kebab-case (module UserDB → user-db.ts)
import { assert, contractsEnabled } from './contracts.ts';
import { mkUser } from './types.ts';
import type { User, UserId } from './types.ts';

// index.ts
export * from './contracts.ts';
export * from './types.ts';
export * from './user-db.ts';
```

Why this one rule (all measured):

| Written as | Node.js type stripping | Vitest | `tsc --noEmit` |
|---|---|---|---|
| `from './types.ts'` | runs | runs | TS5097 unless `allowImportingTsExtensions` is set |
| `from './types'` | `ERR_MODULE_NOT_FOUND` | runs | accepted with `moduleResolution: bundler`; with `nodenext`, TS2835 when the nearest `package.json` has `"type": "module"` and accepted otherwise (5.9.3, 6.0.3 and 7.0.2) |
| `from './types.js'` | `ERR_MODULE_NOT_FOUND` | runs | accepted |
| `import { User }` where `User` is only a type | SyntaxError at run time | runs | accepted; TS1484 with `verbatimModuleSyntax` |

Type-checking with `tsc` is optional and needs the `typescript` and
`@types/node` packages. Use `noEmit` together with `allowImportingTsExtensions`.
Adding `erasableSyntaxOnly` and `verbatimModuleSyntax` makes `tsc` reject what
Node.js would reject at run time (with `module: nodenext`, `verbatimModuleSyntax`
also needs `"type": "module"` in `package.json`). To emit `.js` files, use
`rewriteRelativeImportExtensions` instead of `allowImportingTsExtensions`.
Node.js's documentation recommends TypeScript 5.8 or newer with
`erasableSyntaxOnly`, `verbatimModuleSyntax` and `rewriteRelativeImportExtensions`.
Do not create a `tsconfig.json` or install packages unless the user asks.

### Type-checking the Generated Files / 生成ファイルの型チェック

Nothing on the default path type-checks the output (Node.js type stripping and
Vitest erase types; a file with a type error still runs — measured). When a type
check is wanted, these are the measured behaviours:

| Situation | Command and result |
|---|---|
| Default output (`.ts` imports), no `tsconfig.json`, `typescript` and `@types/node` installed | `npx tsc --noEmit --allowImportingTsExtensions --strict --target es2022 --module nodenext --skipLibCheck --types node generated/index.ts` exits 0 on tsc 5.9.3, 6.0.3 and 7.0.2, with or without `"type": "module"`; adding `--erasableSyntaxOnly --verbatimModuleSyntax` also exits 0 with `"type": "module"` |
| `@types/node` not installed | `process` in `contracts.ts` fails: TS2580 on 5.9.3 (run without `--types`), TS2688 on 6.0.3 and 7.0.2 (run with `--types node`) |
| TypeScript 6 and later, `--types node` omitted | TS2591 on `process`: TypeScript 6.0.3 and 7.0.2 do not include `@types/*` packages automatically, 5.9.3 does |
| A `tsconfig.json` exists and files are named on the command line | 5.9.3 ignores the `tsconfig.json` silently; 6.0.3 and 7.0.2 stop with TS5112 until `--ignoreConfig` is added (`--ignoreConfig` is an unknown option, TS5023, on 5.9.3). Read `npx tsc --version` before building the command |
| The project's `tsconfig.json` has `"include": ["src"]` and `generated/` is elsewhere | `npx tsc --noEmit` exits 0 and `npx tsc --noEmit --listFilesOnly` lists no `generated/` path: that run is not a check of the generated code |
| ts-jest (`module: commonjs`, no `allowImportingTsExtensions`) | ts-jest type-checks the files it loads: a `.ts`-extension import is TS5097, the extensionless form runs |
| `Object.hasOwn` under `target: ES2020` | TS2550 (5.9.3, 6.0.3 and 7.0.2). Use `Object.prototype.hasOwnProperty.call` in generated code |

型チェックは既定の経路では行われない。行う場合は上の表のコマンドを使い、プロジェクトの
`tsconfig.json` が `generated/` を対象にしているかを `--listFilesOnly` で先に確かめる。

## Type Conversion / 型の変換

### Basic Types / 基本型

| VDM-SL | TypeScript | Notes / 備考 |
|--------|-----------|------|
| `bool` | `boolean` | |
| `nat` | `number` | Runtime check: `Number.isSafeInteger(n) && n >= 0`; bounded representation |
| `nat1` | `number` | Runtime check: `Number.isSafeInteger(n) && n >= 1`; bounded representation |
| `int` | `number` | `Number.isSafeInteger(n)`; bounded representation |
| `real` | `number` | Finite floating-point approximation, not exact VDM real arithmetic |
| `char` | `string` | Single character string / 1文字の文字列 |
| `token` | `symbol` または `string` | Branded type recommended / ブランド型推奨 |

Use branded types for stricter nat/nat1 representation: / nat/nat1をより厳密に表現したい場合はブランド型を使用:
```typescript
type Nat = number & { readonly __brand: 'nat' };
type Nat1 = number & { readonly __brand: 'nat1' };

function asNat(n: number): Nat {
  if (!Number.isSafeInteger(n) || n < 0) throw new ContractError(`nat constraint: ${n} is not a non-negative safe integer`);
  return n as Nat;
}
```

### Compound Types / 複合型

| VDM-SL | TypeScript |
|--------|-----------|
| `seq of T` | `T[]` |
| `seq1 of T` | `T[]` (runtime: `.length > 0`) |
| `set of T` | `Set<T>` |
| `set1 of T` | `Set<T>` (runtime: `.size > 0`) |
| `map K to V` | `Map<K, V>` |
| `[T]` (option) | `T \| null` |
| `T1 \| T2` (union) | `T1 \| T2` |
| `<A>` (quote literal) | `'A'` |
| `<A> \| <B>` (union of quotes) | `'A' \| 'B'` (string-literal union, never `enum`) |

### Quote Types → String-Literal Union / 引用型

```
VDM-SL:
  Status = <Todo> | <InProgress> | <Done>;
```

```typescript
/** VDM-SL: Status = <Todo> | <InProgress> | <Done> */
export type Status = 'Todo' | 'InProgress' | 'Done';

/** Runtime list of the values / 実行時に値を列挙するための配列 */
export const STATUS_VALUES: readonly Status[] = ['Todo', 'InProgress', 'Done'];

export function isStatus(x: unknown): x is Status {
  return STATUS_VALUES.includes(x as Status);
}
```

### Record Types → interface + Factory Function / レコード型

```
VDM-SL:
  User :: name  : seq1 of char
          email : seq1 of char
          age   : nat
  inv u == u.age <= 150;
```

```typescript
/** VDM-SL Record: User */
export interface User {
  readonly name: string;
  readonly email: string;
  readonly age: number;
}

/** Invariant: User / 不変条件 */
export function invUser(u: User): boolean {
  return u.name.length > 0
    && u.email.length > 0
    && Number.isSafeInteger(u.age) && u.age >= 0
    && u.age <= 150;
}

/** Factory: mk_User / ファクトリ関数 */
export function mkUser(name: string, email: string, age: number): User {
  const u: User = { name, email, age };
  if (!invUser(u)) {
    throw new ContractError(`User invariant violated: ${JSON.stringify(u)}`);
  }
  return u;
}
```

The factory checks the invariant on every call; it is not guarded by
`contractsEnabled()`. Fields are `readonly` and records are replaced, never
mutated in place. `mu(r, age |-> 30)` therefore becomes a new factory call
(`mkUser(r.name, r.email, 30)`), which re-checks the invariant.
/ ファクトリ関数は常に不変条件をチェックする（`VDM_CONTRACT_CHECK` の対象外）。レコードは書き換えず、
`mu` はファクトリ関数の呼び直しに変換する。

### Type Aliases / 型の別名

```
VDM-SL: UserId = nat1;
```

```typescript
export type UserId = number;

export function isValidUserId(id: number): boolean {
  return Number.isSafeInteger(id) && id >= 1;
}
```

A type alias that carries an invariant follows the same naming as a record
(`../SKILL.md` Step 5: `invT` and `mkT`), not `isValidT`: / 不変条件つきの別名は、
レコードと同じ名前の付け方（`invT` と `mkT`）にする。

```
VDM-SL: Title = seq1 of char
        inv t == len t <= 100;
```

```typescript
/** VDM-SL: Title = seq1 of char inv t == len t <= 100 */
export type Title = string;

/** Invariant: Title (the seq1 constraint and the inv) / 不変条件 */
export function invTitle(t: string): boolean {
  return t.length >= 1 && t.length <= 100;
}

/** Factory: checks the invariant on every call / ファクトリ関数 */
export function mkTitle(t: string): Title {
  if (!invTitle(t)) {
    throw new ContractError(`Title invariant violated: length ${t.length} is not in 1..100`);
  }
  return t;
}
```

Like `mkUser`, `mkTitle` is not guarded by `contractsEnabled()` (measured: it
throws `ContractError` with `VDM_CONTRACT_CHECK=off` as well).

## Function Conversion / 関数の変換

### With Explicit Definition (convert implementation) / 明示的定義あり

```
VDM-SL:
  findUser: UserId * map UserId to User -> User
  findUser(uid, users) == users(uid)
  pre uid in set dom users;
```

```typescript
/**
 * VDM-SL: findUser
 * @pre uid in set dom users
 */
export function findUser(uid: UserId, users: Map<UserId, User>): User {
  // Pre-condition
  if (contractsEnabled()) {
    assert(users.has(uid), `Pre-condition failed: uid ${uid} not in dom users`);
  }

  // Implementation (from VDM-SL body)
  const result = users.get(uid)!;

  return result;
}
```

### Implicit Definition (generate stub) / 暗黙的定義

An implicit definition has no body: the parameters and the result are named
and typed in the heading, and `post` refers to the result by that name (not
`RESULT`). / 暗黙的定義には本体が無い。見出しで引数と戻り値に名前と型を付け、`post` では
戻り値をその名前で参照する（`RESULT` ではない）。

VDM-SL:

```vdm-sl
functions
  sqrt(x : real) r : real
  pre x >= 0
  post r * r = x and r >= 0;
```

```typescript
/**
 * VDM-SL: sqrt (implicit definition)
 * @pre x >= 0
 * @post r * r = x and r >= 0
 */
export function sqrt(x: number): number {
  // Pre-condition
  if (contractsEnabled()) {
    assert(x >= 0, `Pre-condition failed: x = ${x} < 0`);
  }

  // TODO: Implement - must satisfy: r * r = x and r >= 0
  const result: number = Math.sqrt(x);

  // Post-condition
  if (contractsEnabled()) {
    assert(
      Math.abs(result * result - x) < 1e-10 && result >= 0,
      `Post-condition failed: result = ${result}`
    );
  }

  return result;
}
```

## Operation Conversion / 操作の変換

Operations modify state, so they are generated as class methods. / 操作は状態を変更するため、クラスのメソッドとして生成する。
The class is named after the VDM-SL state and exported; the file is named after
the module (`../SKILL.md` Step 3). / クラス名は状態名、ファイル名はモジュール名（kebab-case）。

```
VDM-SL:
  state UserDB of
    users : map UserId to User
    nextId : UserId
  inv mk_UserDB(users, nextId) == forall id in set dom users & id < nextId
  init s == s = mk_UserDB({|->}, 1)
  end

  RegisterUser: seq1 of char * Email ==> UserId
  RegisterUser(name, email) == ...
  pre email not in set {users(id).email | id in set dom users}
  post RESULT = nextId~ and nextId = nextId~ + 1 and
       users = users~ munion {RESULT |-> mk_User(name, email, 0)};

  RemoveUser: UserId ==> ()
  RemoveUser(id) == users := {id} <-: users
  pre id in set dom users
  post users = {id} <-: users~ and nextId = nextId~;
```

```typescript
/** VDM-SL State: UserDB */
export class UserDB {
  private _users: Map<UserId, User>;
  private _nextId: UserId;

  constructor() {
    // init s == s = mk_UserDB({|->}, 1)
    this._users = new Map();
    this._nextId = 1;
    this.checkInvariant();
  }

  /** State invariant / 状態不変条件 */
  private checkInvariant(): void {
    if (!contractsEnabled()) return;
    assert(
      [...this._users.keys()].every(id => id < this._nextId),
      `State invariant violated: an id in dom users is not below nextId ${this._nextId}`
    );
  }

  /** Read-only accessor / 読み取り専用 */
  get users(): ReadonlyMap<UserId, User> { return this._users; }
  get nextId(): UserId { return this._nextId; }

  /**
   * VDM-SL Operation: RegisterUser
   * @pre email not in set {users(id).email | id in set dom users}
   * @post RESULT = nextId~ and nextId = nextId~ + 1 and
   *       users = users~ munion {RESULT |-> mk_User(name, email, 0)}
   */
  registerUser(name: string, email: string): UserId {
    const checking = contractsEnabled();

    // Pre-condition (checked before anything is changed)
    if (checking) {
      assert(name.length > 0, 'Pre-condition failed: name must be non-empty (seq1)');
      assert(email.length > 0, 'Pre-condition failed: email must be non-empty (seq1)');
      const existingEmails = new Set([...this._users.values()].map(u => u.email));
      assert(!existingEmails.has(email), `Pre-condition failed: email ${email} already exists`);
    }

    // Old-state snapshot for the post-condition (users~, nextId~)
    const usersOld = checking ? new Map(this._users) : undefined;
    const nextIdOld = this._nextId;

    // Implementation
    const uid = this._nextId;
    this._users.set(uid, mkUser(name, email, 0));
    this._nextId = this._nextId + 1;

    // State invariant check
    this.checkInvariant();

    // Post-condition
    if (usersOld !== undefined) {
      assert(uid === nextIdOld, 'Post-condition failed: RESULT = nextId~');
      assert(this._nextId === nextIdOld + 1, 'Post-condition failed: nextId = nextId~ + 1');
      const expected = new Map([...usersOld, [uid, mkUser(name, email, 0)]]);
      assert(vdmEquals(this._users, expected), 'Post-condition failed: users = users~ munion {RESULT |-> ...}');
    }

    return uid;
  }

  /**
   * VDM-SL Operation: RemoveUser
   * @pre id in set dom users
   * @post users = {id} <-: users~ and nextId = nextId~
   */
  removeUser(id: UserId): void {
    const checking = contractsEnabled();
    if (checking) {
      assert(this._users.has(id), `Pre-condition failed: id ${id} not in dom users`);
    }
    const usersOld = checking ? new Map(this._users) : undefined;
    const nextIdOld = this._nextId;

    this._users.delete(id);

    this.checkInvariant();
    if (usersOld !== undefined) {
      const expected = new Map(usersOld);
      expected.delete(id);
      assert(vdmEquals(this._users, expected), 'Post-condition failed: users = {id} <-: users~');
      assert(this._nextId === nextIdOld, 'Post-condition failed: nextId = nextId~');
    }
  }
}
```

Rules for operations (the example above ran under Node.js type stripping, Vitest
and ts-jest with these rules — measured):

- **Order inside a method**: pre-condition → old-state snapshot → body →
  `checkInvariant()` → post-condition. Because the pre-condition is checked
  before anything is changed, a rejected call leaves the state as it was.
- **Old-state values (`x~`)**: copy each state component that the post-condition
  reads with `~` before the body runs, and only when checks are enabled. A
  shallow copy is enough (`new Map(m)`, `new Set(s)`, `[...xs]`), because records
  are never mutated in place.
- **Equality in post-conditions**: compare records, maps, sets and sequences
  with `vdmEquals` (below). `===` on two objects compares identity and is
  false for two equal records.
- **`atomic( a := e1; b := e2 )`**: emit the assignments in order and call
  `checkInvariant()` once after the last one, not between them.
- **No rollback**: when `checkInvariant()` or a post-condition fails after the
  body ran, the state stays changed. Record this as a representation difference.

/ メソッド内の順序は「事前条件 → 操作前の状態のコピー → 本体 → 状態不変条件 → 事後条件」。
`x~` は本体の前に取ったコピーで表す（チェックが有効なときだけ。浅いコピーでよい）。レコード・マップ・
集合・列の `=` は `vdmEquals` で比べる（`===` は同一性の比較）。`atomic` は代入を順に書き、最後に
1回だけ不変条件をチェックする。

## Contract Verification Infrastructure / 契約検証の基盤コード

Common utilities that all generated files depend on: / 生成ファイルが依存する共通ユーティリティ:

```typescript
// contracts.ts

/** Contract violation error */
export class ContractError extends Error {
  constructor(message: string) {
    super(`[Contract Violation] ${message}`);
    this.name = 'ContractError';
  }
}

/** 契約チェックの有効/無効（環境変数で制御） */
export function contractsEnabled(): boolean {
  return process.env.VDM_CONTRACT_CHECK !== 'off';
}

/** アサーション */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new ContractError(message);
  }
}

/**
 * Structural equality for VDM values (VDM-SL `=` on records, sequences, sets and maps).
 * JavaScript `===` compares object identity, so never use it for these.
 * Emit this helper when the spec compares such values.
 */
export function vdmEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((x, i) => vdmEquals(x, b[i]));
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    const entries = [...b];
    for (const [k, v] of a) {
      const hit = entries.find(([k2]) => vdmEquals(k, k2));
      if (hit === undefined || !vdmEquals(v, hit[1])) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    const members = [...b];
    return [...a].every(x => members.some(y => vdmEquals(x, y)));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = Object.keys(ra);
  return keys.length === Object.keys(rb).length
    && keys.every(k => Object.prototype.hasOwnProperty.call(rb, k) && vdmEquals(ra[k], rb[k]));
}
```

`vdmEquals` compares two values that already exist. It does not change how
`Set` and `Map` store their members: a `Set<User>` still treats two equal
records as two members, and `Map.get` / `Set.has` still look up by identity for
object keys. Record that as a representation difference when the spec uses
records as set members or map keys.
/ `vdmEquals` は値どうしの比較だけを構造的にする。`Set` / `Map` 自体は、オブジェクトを同一性で区別する。

Because of `process.env`, type-checking this file with `tsc` needs Node.js type
definitions (`@types/node`; the error codes without them differ by TypeScript
version and are in the table under "Type-checking the Generated Files");
running it under Node.js or Vitest does not (measured).
/ `process.env` を使うため、`tsc` での型チェックには `@types/node` が必要。実行には不要。

## VDM-SL Expression Mapping Patterns / VDM-SL式の変換パターン

| VDM-SL式 | TypeScript |
|---------|-----------|
| `e in set S` | `S.has(e)` |
| `e not in set S` | `!S.has(e)` |
| `dom m` | `new Set(m.keys())` |
| `rng m` | `new Set(m.values())` |
| `m(k)` | `m.get(k)!` (guaranteed by pre-condition / 事前条件で存在保証) |
| `card S` | `S.size` |
| `len s` | `s.length`. For `seq of char` (a string) this counts UTF-16 code units: a character outside the BMP (most emoji, some kanji such as 𠮷) counts as 2. VDMJ 4.7.0 counts the same way (measured: `len "😀" = 2`), so the code agrees with VDMJ, but not with a reader's idea of "N characters". List it under representation differences when the spec limits a string length |
| `s(i)` | `s[i - 1]` (VDM-SL sequences are 1-based) |
| `s(i, ..., j)` | `s.slice(i - 1, j)` |
| `elems s` | `new Set(s)` |
| `inds s` | `s.map((_, k) => k + 1)` |
| `s1 ^ s2` | `[...s1, ...s2]` |
| `hd s` | `s[0]` |
| `tl s` | `s.slice(1)` |
| `m1 munion m2` | `new Map([...m1, ...m2])` |
| `m ++ {k \|-> v}` | `new Map([...m, [k, v]])` |
| `{k} <-: m` | `(() => { const r = new Map(m); r.delete(k); return r; })()` |
| `mk_T(a, b)` | `mkT(a, b)` (via factory function / ファクトリ関数経由) |
| `mu(r, f \|-> v)` | a new factory call with the changed field, e.g. `mkT(r.a, v)` (re-checks the invariant) |
| `r.field` | `r.field` |
| `A * B` (product type) | `readonly [A, B]` |
| `mk_(a, b)` | `[a, b]` (annotate the function's return type as the tuple type) |
| `t.#1`, `t.#2` | `t[0]`, `t[1]` |
| `a = b` on numbers, booleans, strings, quote values | `a === b` |
| `a = b` on records, sequences, sets, maps | `vdmEquals(a, b)` (never `===`) |
| `[f(x) \| x in set S]` (S a set of numbers) | `[...S].sort((a, b) => a - b).map(x => f(x))` (ascending order; a bare `.sort()` sorts as text and is wrong for numbers) |
| `[f(s(i)) \| i in set inds s & P(s(i))]` | `s.filter(x => P(x)).map(x => f(x))` |
| `forall x in set S & P(x)` | `[...S].every(x => P(x))` |
| `exists x in set S & P(x)` | `[...S].some(x => P(x))` |
| `exists1 x in set S & P(x)` | `[...S].filter(x => P(x)).length === 1` |
| `x~` in an operation post-condition | the snapshot taken before the body (see Operation Conversion) |
| `if P then A else B` | `P ? A : B` |
| `let x = e in body` | `(() => { const x = e; return body; })()` |

## Naming Conventions / 命名規則

| VDM-SL | TypeScript |
|--------|-----------|
| `UserId` (type / 型) | `UserId` (type alias) |
| `mk_User` (constructor / コンストラクタ) | `mkUser` (factory function / ファクトリ関数) |
| `inv_User` (invariant / 不変条件) | `invUser` (validation function / 検証関数) |
| `pre_findUser` (pre-condition / 事前条件) | guard clause in function / 関数内のガード節 |
| `RegisterUser` (operation / 操作) | `registerUser` (method, camelCase / メソッド、camelCase) |
| `UserDB` (state / 状態) | `UserDB` (exported class / export するクラス) |
| `module TaskManager` (module / モジュール) | file `task-manager.ts` (kebab-case of the module name / モジュール名の kebab-case) |
