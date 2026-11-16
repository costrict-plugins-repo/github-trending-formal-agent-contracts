---
name: generate-tests
description: >
  VDM-SL仕様と設計文書（PROTOCOL.md、API-SIGNATURES.md）から
  契約テストを自動生成し、実行できる1つのコマンドまで案内する。
  既存のテストランナー（Vitest/Jest/Mocha/node:test）があればそれに合わせ、
  無ければ（空のディレクトリでも）最小構成を提案してから生成する。Javaは不要。
  「仕様からテストを生成して」「契約テストを生成して」「契約テストを作って」「テストを自動生成して」
  「不変条件のテストを書いて」「プロトコルのテストを作って」
  「境界値テストを生成して」といったリクエストに使用する。
  English triggers: "generate tests from the spec", "create contract tests",
  "auto-generate tests", "generate boundary tests from the VDM spec".
  型不変式・事前条件・事後条件・状態遷移規則・ペイロード構造から
  テストコードを導出し、実装と仕様の乖離を検出する。
metadata:
  version: "2.2.0"
  author: Formal Agent Contracts
  tags: [vdm-sl, test-generation, automated-testing, vitest, node-test, model-routing]
---

# 契約テスト自動生成スキル

VDM-SL形式仕様および設計文書から自動的にユニットテストコードを生成するスキルです。VDM-SL仕様に記述された型不変式、前提条件、事後条件と、設計文書（PROTOCOL.md、API-SIGNATURES.md）に記述されたプロトコル規則をテストコードに変換し、実装が仕様の条項から外れていないかをテストします。

## 背景：VDM-SL仕様と設計文書の役割分担

エージェント開発は2つのフェーズで契約を定義します：

| フェーズ | 役割 | 成果物 | このスキルでの使用 |
|--------|------|--------|-----------------|
| **Phase 1：ドメイン設計** | 各エージェント内部のロジックを形式化 | VDM-SL仕様ファイル | 型不変式、事前・事後条件テスト生成 |
| **Phase 2：インターフェース設計** | エージェント間通信を定義 | PROTOCOL.md、API-SIGNATURES.md | プロトコルテスト生成 |

### 実装時に発生する可能性のある問題と検出方法

| 問題カテゴリ | 例 | 検出方法 |
|------------|-----|--------|
| **実装バグ（ドメイン層）** | 事後条件のロジック誤り | ✓ VDM-SLテストで検出 |
| **言語固有の問題** | JavaScriptの型強制、nullの扱い | ✓ VDM-SLテストで検出 |
| **プロトコル層バグ** | メッセージ型とペイロードの不整合 | ✓ 設計文書テストで検出 |
| **エッジケース** | 境界値での動作未定義 | ✓ VDM-SLテストで検出 |
| **並行処理の問題** | レースコンディション（複数エージェント） | 統合テストで検出 |

このスキルは以下の2つのソースから自動テスト生成します：

**VDM-SL仕様から生成：**
1. **型不変式テスト**：型の制約が常に満たされるか
2. **前提条件テスト**：関数が前提条件を期待通り検証するか
3. **事後条件テスト**：関数が事後条件を満たす結果を返すか
4. **境界値テスト**：エッジケースでの動作

**設計文書（PROTOCOL.md、API-SIGNATURES.md）から生成（この2つがある場合のみ）：**
5. **プロトコルテスト**：メッセージの型安全性、状態遷移の正確性、API署名の一貫性

## ステップ0：テスト実行環境の確認

**目的**：生成したテストを「1つのコマンドで実行できる」状態で終える。テストランナーや `package.json` が既にあるとは仮定しない。Node.js だけが入った空のディレクトリ（Javaなし）からでも最後まで進められること。

### 0a. 検出する（推測せず、ファイルとコマンド出力を読む）

| 確認すること | 読むもの |
|---|---|
| テストランナー | `package.json` の `scripts.test` と、`dependencies` / `devDependencies` にある `vitest`・`jest`・`mocha`。`vitest.config.*`、`jest.config.*` |
| TypeScript設定 | `tsconfig.json` の有無と内容 |
| 既存テストの慣習 | 既存テストファイルの命名（`*.test.ts`、`*.spec.ts` など）、置き場所、import の書き方 |
| Node.js | `node -v` と `node -p "process.features.typescript"` の出力 |
| テスト対象の実装 | `generate-code` は仕様ファイルと同じディレクトリの `generated/` に出力する。まずそこを読む |

- 無いものは「無い」と記録する。読んでいないファイルの内容や、実行していないコマンドの結果を前提にしない。
- 実装が見つからない場合は、テストを書く前にユーザーへ伝え、`generate-code` を先に実行するか、実装の場所を教えてもらう。テスト側で実装を代わりに書かない。

### 0b. ランナーが既にある場合

- そのランナーを使い、テストの置き場所・命名・import・アサーションの書き方はプロジェクトの慣習に合わせる。
- **置き場所の決め方**：既存テストの置き方で決める。
  - 既存テストが専用のディレクトリ（`test/`、`tests/`、`__tests__/` など）にある → そのディレクトリに置く。
  - 既存テストが実装の隣にある（`src/foo.ts` と `src/foo.test.ts`）→ 生成された実装の隣、つまり `generated/<実装ファイル名>.test.ts` に置く（例：`generated/task-manager.test.ts`）。`generate-code` は自分が生成したファイル以外を `generated/` から削除・上書きしない。
  - どちらの場合も、ランナーの設定（Jest の `roots` / `testMatch`、Vitest の `include` など）がそのファイルを拾うことを、生成したファイルだけを対象に実行して確かめる。拾われない場合（「No tests found」など）は、設定を無断で変えずにユーザーへ確認する。
- **import の書き方**：既存のテストに合わせる（拡張子の有無、`describe` / `it` / `expect` を import するかどうか）。例：ts-jest で `tsconfig.json` に `allowImportingTsExtensions` が無いプロジェクトでは、`.ts` 拡張子付きの import は TS5097 で失敗し、拡張子なしなら動く（Jest 30.5.2 + ts-jest 29.4.15 + TypeScript 6.0.3 で実測）。`generate-code` はこの場合、拡張子なしで出力する（同スキルの Step 2.7）。実際の書き方は `generated/` のファイルを読んで確かめる。
- 依存パッケージを追加しない。
- 既存の `package.json` や `tsconfig.json` は、ユーザーに確認せずに編集しない（`scripts` の追加・変更も含む）。
- 実行は生成したテストファイルだけを対象にする（例：`npx vitest run <生成したファイル>`、`npx jest <生成したファイル>`）。プロジェクト全体のテストを無断で走らせない。ユーザーが断らない限り、このコマンドを自分で実行してから報告する（5a）。
- ユーザーがふだん使うテストコマンド（`npm test` など）に新しいファイルが含まれるかは、テストを実行せずに一覧だけを出すコマンドで確かめられる：Jest は `npx jest --listTests`、Vitest は `npx vitest list --filesOnly`（Jest 30.5.2 と Vitest 5.1.0 で実測）。結果を完了報告に書く。

### 0c. ランナーが無い場合：1回だけ質問する

AskUserQuestion で**1回だけ**質問し、次の3つを**この順番で**（推奨を先頭に）提示する。ユーザーが選ぶまで、インストールコマンド（`npm install` など）を実行しない（オプトイン）。

| | 選択肢 | 選択肢の説明として伝える1〜2文（平易に） |
|---|---|---|
| (a) | **Vitest の最小構成を作る（推奨）** | テスト用のツール（Vitest）をこのフォルダにインストールして、テストを実行します。ネットワーク接続が必要で、`package.json`・`package-lock.json`・`node_modules/` ができます。 |
| (b) | **依存ゼロ：Node.js 組み込みのテストランナーを使う** | 何もインストールせず、Node.js に最初から入っているテスト機能で実行します。続けて、0a の結果から「この環境で使えます」または「この環境では使えません（理由）」のどちらかを必ず書く。 |
| (c) | **テストファイルだけ生成する** | テストのファイルだけを作ります。何もインストールせず、実行もしません。 |

- 選択肢の説明は上の1〜2文にとどめる。型ストリッピング・消去可能な構文・エラーコードなどの詳細（下の (b) の制約）は、Claude 自身が 0a で確かめて結論だけを伝え、ユーザーに判断させない。詳細はユーザーに聞かれたときに伝える。
- (b) を「この環境で使えます」と書いてよいのは、0a で次の3つを確かめたときだけ：`node -p "process.features.typescript"` の出力が `strip`、カレントディレクトリから親ディレクトリへたどって最初に見つかる `package.json` に `"type": "commonjs"` が無い（どこにも `package.json` が無い場合も含む）、`generated/` の実装が拡張子 `.ts` 付きの import と消去可能な構文だけで書かれている。1つでも満たさなければ「この環境では使えません」とし、理由を1つ添える。

#### (a) Vitest の最小構成

`package.json` が無いときだけ、プロジェクトルート（空のディレクトリから始めた場合はそのディレクトリ）に次の内容で新規作成する：

```json
{
  "name": "contract-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  }
}
```

続けて、同じディレクトリで `npm install --save-dev vitest` を実行する。

- このコマンドは `package.json` に `devDependencies` を書き足し、`package-lock.json` と `node_modules/`（Vitest 5.1.0 で35パッケージ・約35MB。実測）を作る。完了報告の「生成したファイル」には `package.json` と `package-lock.json` を挙げ、`node_modules/` ができたことも書く。
- そのディレクトリが git リポジトリの中にあり、`.gitignore` が `node_modules/` を除外していない場合は、`.gitignore` に `node_modules/` を追加するよう完了報告で勧める（`.gitignore` を無断で作成・編集しない）。
- `"type": "module"` は、生成コードが ESM（`import` / `export`）であることを明示するために付ける。
- インストールの出力を読む。失敗や `EBADENGINE` 警告（Vitest が対応する Node.js の範囲外）が出たら、成功扱いにせずそのまま報告する。対応範囲はインストールされた Vitest の `package.json` の `engines` に書かれている。ここに固定のバージョンは書かない。
- `package.json` が既にあり、ランナーだけが無い場合は新規作成しない。(a) の説明に「既存の `package.json` に devDependency（`vitest`）を追加する。`scripts.test` が未定義のときだけ `vitest run` を追加する」と明記して同意を得る。既存の `scripts.test` は上書きせず、その場合の実行コマンドは `npx vitest run` にする。
- 実行コマンド：`npm test`

#### (b) Node.js 組み込みテストランナーの制約

次の制約は、Claude 自身が 0a の結果と照らして確かめる（ユーザーへは「使える／使えない（理由）」の結論を伝え、詳細は聞かれたときに正確に伝える）。「実測」はこのスキルの作成時に Node.js v26.4.0 で確認した挙動、「ドキュメント」は Node.js 公式ドキュメントの記載を指す。それ以外のバージョンでの挙動は、実際に実行して確かめる。

- `.ts` ファイルをそのまま実行するには、型ストリッピングが既定で有効な Node.js が必要。既定で有効になったのは v22.18.0 / v23.6.0（ドキュメント）。判定はバージョン番号からの推測ではなく、`node -p "process.features.typescript"` が `strip` を出力することで行う（実測）。
- 実行できるのは「消去可能（erasable）」な TypeScript 構文だけ。`enum`、`namespace`（実行時コードを持つもの）、コンストラクタの parameter properties（`constructor(private x: number)`）は `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` で失敗する（実測）。
- 相対 import には拡張子が必須（`'../generated/index.ts'`）。拡張子なしや `.js` では `ERR_MODULE_NOT_FOUND` になる（実測）。型だけの import は `import type` で書く。`type` が無いと実行時に SyntaxError になる（実測）。
- 型は取り除かれるだけで、型検査は行われない（実測：型エラーのあるファイルもそのまま実行される）。`tsconfig.json` は読まれない（ドキュメント）。
- カレントディレクトリから親ディレクトリへたどって最初に見つかる `package.json` に `"type": "commonjs"` があると、`import` 文を含む `.ts` は失敗する（実測）。カレントディレクトリに `package.json` が無くても、親ディレクトリのものが効く（実測）ので、親ディレクトリも確かめる。`package.json` があって `"type"` が書かれていない場合、テストは動くが、Node.js が `MODULE_TYPELESS_PACKAGE_JSON` の警告を出力に加える（実測）。

`generate-code` の既定の出力（消去可能な構文のみ・`.ts` 拡張子付き import）はこれらを満たす。Node.js が条件を満たさない、または対象コードがこれらに違反している場合（対象ファイルを読むか、実行時のエラーコードで判断する）は、(b) が使えないことと理由を伝えて (a) に切り替える。(a) はインストールを伴うので、切り替えにはユーザーの同意が要る。0a の時点で (b) が使えないと分かっている場合は、選択肢は3つとも提示したうえで、(b) の説明にその旨と理由を書く。

- 実行コマンド：`node --test "tests/**/*.test.ts"` のように、生成したテストのパス（またはダブルクォートで囲んだグロブ）を必ず指定する。引数なしの `node --test` は使わない。既定の探索パターン（`**/test-*.ts`、`**/test/**/*.ts` など。ドキュメント）に一致する無関係なファイルまで実行されるため（実測）。
- 一致するテストが0件でも `node --test` は終了コード0で終わる（実測）。`tests 0` は成功として扱わない。グロブは実行したディレクトリからの相対パスなので、別のディレクトリ（たとえば `generated/` の中）で同じコマンドを実行すると、0件・終了コード0になる（実測）。完了報告には実行ディレクトリと、出力の `tests` が0でないことを確かめるよう書く。
- (b) では `package.json` を作らないので、実行コマンドが残る場所がチャットの報告だけになる。生成したテストファイルの先頭に、実行コマンドと実行するディレクトリをコメントで書いておく。

#### (c) テストファイルだけ生成

テストは Vitest 形式（`describe` / `it` / `expect`）で書く。何もインストールせず、実行もしない。完了報告には (a) の手順（`package.json` の内容と `npm install --save-dev vitest`）を「実行に必要なもの」として書き、実行結果は「未実行」とする。

この3つの選択肢は TypeScript / JavaScript の実装を対象にしている。実装が別の言語の場合も方針は同じ（検出する → 既存のランナーに従う → 無ければ1回だけ質問し、インストールはオプトイン）で、その言語のランナーについて確認する。

## ステップ1：VDM-SLファイルと設計文書の解析

**目的**：VDM-SLファイルと設計文書から型、関数、契約、プロトコル仕様を抽出

次の情報は、まず会話とワークスペース（`.vdmsl`、`generated/`、設計文書）から読み取ります。読み取れないものだけユーザーに確認します：

- **VDM-SLファイル**：解析対象のファイルパス
- **設計文書**：PROTOCOL.md、API-SIGNATURES.md（プロトコルテスト対象）。無ければプロトコルテスト（戦略D・ステップ4）は生成せず、その旨を完了報告に書く。存在しない文書の内容を想定してテストを書かない
- **テスト対象関数**：全関数 / 特定関数のみ（指定が無ければ全関数）
- **テスト対象言語**：ステップ0で見つけた実装の言語
- **テストランナー**：ステップ0で確定したものを使う（ここで改めて質問しない）

**スキルの処理**：
```
ステップ1a: VDM-SLファイルの構文解析
  ✓ モジュール構造を抽出
  ✓ 型定義を解析
  ✓ 関数シグネチャを抽出

ステップ1b: 契約情報の抽出
  ✓ 前提条件（pre）を読み込み
  ✓ 事後条件（post）を読み込み
  ✓ 不変式（inv）を収集

ステップ1c: メタデータの生成
  ✓ 関数の入出力型を記録
  ✓ テスト生成戦略を決定
  ✓ テストケース数を見積もり

出力例：
  [解析結果サマリー]
  ファイル: HybridJudgeAgent.vdmsl
  検出された型: 6個
    - Score (nat1, inv: 1<=s<=100)
    - Threshold (nat1, inv: 1<=t<=100)
    - Action (Quote型)
    - Ticket (Record型)
    - ...
  
  検出された関数: 3個
    - decide(Ticket, Threshold, Threshold) -> Action
    - scoreAll(seq of Score) -> seq of Score
    - explainDecision(Action) -> seq1 of char
  
  推定テストケース数: 25-35個
```

## ステップ1.5：モデルルーティングの確認（任意・トークン削減）

仕様ファイルの隣に `model-routing.json`（`route-models` スキルの成果物）が存在する場合：

- モジュールごとに、割り当てモデルのサブエージェントでテスト生成を実行する
  （Claude Code では Task ツールの `model` パラメータ。層→モデル対応は必ず
  ルーティングファイルの `tiers` から読み、モデル名をハードコードしない）
- ファイルに記載のないモジュールは `defaults.tier` を適用する
- 生成テストのゲートは「実行して緑・型チェック」だけでは不十分（薄いスイートは
  自明に通ってしまう）。契約から機械的に導いた**条項→テスト対照表**で判定する：
  モジュール内のすべての inv / pre / post / 状態遷移条項に、対応するテストが
  少なくとも1つあること。対応漏れは検証失敗として数える。
  同一モジュールで2回検証に失敗したら1層上げて再生成し、`escalation.history` と
  MODEL-ROUTING.md の「Escalations」の両方に追記する（詳細は `route-models`
  スキルの `references/routing-rules.md` §4）
- サブエージェントのモデル指定が使えない環境では、推奨表として提示して
  通常どおり進める。ルーティング不可を理由にフェーズを失敗させない

ルーティングファイルが無ければ、このステップはスキップして通常どおり進める。

## ステップ2：テスト戦略の選択

**目的**：各関数に適したテスト生成戦略を決定

関数ごとに以下の戦略から選択：

### 戦略 A：型値テスト
**適用対象**：入力型が単純（nat1, bool, Quote型等）な関数
**テスト内容**：
- 有効な値の入力
- 無効な値の入力（型チェック）
- 境界値

```javascript
describe('Score type validation', () => {
  it('accepts valid score (1-100)', () => {
    expect(isValidScore(50)).toBe(true);
  });
  
  it('rejects invalid score (0)', () => {
    expect(isValidScore(0)).toBe(false);
  });
  
  it('rejects invalid score (101)', () => {
    expect(isValidScore(101)).toBe(false);
  });
});
```

### 戦略 B：前提条件テスト
**適用対象**：複雑な前提条件を持つ関数
**テスト内容**：
- 前提条件を満たす入力：実行可能
- 前提条件を満たさない入力：実装が export しているエラークラス（`generate-code` の出力では `ContractError`）が発生する

```javascript
describe('decide function preconditions', () => {
  it('executes when t1 > t2', () => {
    expect(() => decide(ticket, 80, 20)).not.toThrow();
  });
  
  it('throws ContractError when t1 <= t2', () => {
    expect(() => decide(ticket, 20, 80)).toThrow(ContractError);
  });
});
```

### 戦略 C：事後条件テスト
**適用対象**：複雑な出力ロジックを持つ関数
**テスト内容**：
- 各ケースでの出力が事後条件を満たすか
- すべての出力パスをカバー

```javascript
describe('decide function postconditions', () => {
  it('returns OperatorOnly when complexity > t1', () => {
    const ticket = { complexity_score: 90 };
    const result = decide(ticket, 80, 20);
    expect(result).toBe('OperatorOnly');
  });
  
  it('returns OperatorAndLLM when t2 < complexity <= t1', () => {
    const ticket = { complexity_score: 50 };
    const result = decide(ticket, 80, 20);
    expect(result).toBe('OperatorAndLLM');
  });
  
  it('returns AutoReply when complexity <= t2', () => {
    const ticket = { complexity_score: 10 };
    const result = decide(ticket, 80, 20);
    expect(result).toBe('AutoReply');
  });
});
```

### 戦略 D：プロトコルテスト
**適用対象**：PROTOCOL.md、API-SIGNATURES.mdに定義されたプロトコル仕様。この2つの文書が無い場合（単独のエージェントなど）は、この戦略とステップ4を使わない
**テスト内容**：
- メッセージ型とペイロードの整合性（PROTOCOL.mdから抽出）
- 状態遷移の有効性（PROTOCOL.mdから抽出）
- API署名の一貫性（API-SIGNATURES.mdから抽出）
- 方向判定関数の正確性（PROTOCOL.mdから抽出）

```javascript
describe('WsMessage protocol invariants', () => {
  it('TicketCreate message has correct payload type', () => {
    const msg = createMessage('TicketCreate', {
      customer_id: 1,
      title: 'Test'
    });
    expect(msg.msg_type).toBe('TicketCreate');
    expect(isTicketCreatePayload(msg.payload)).toBe(true);
  });
  
  it('rejects mismatched message and payload', () => {
    const msg = {
      msg_type: 'TicketCreate',
      payload: { ticket_id: 1, message: 'wrong' }  // AutoReplyPayload
    };
    expect(validateWsMessage(msg)).toBe(false);
  });
});

describe('State transitions', () => {
  it('allows valid transition Created->Assigned', () => {
    expect(validTransition('Created', 'Assigned')).toBe(true);
  });
  
  it('rejects invalid transition Created->InProgress', () => {
    expect(validTransition('Created', 'InProgress')).toBe(false);
  });
});
```

### 戦略 E：境界値テスト
**適用対象**：数値制約を持つ関数
**テスト内容**：
- 制約の下限・上限
- 制約外の値

```javascript
describe('boundary values', () => {
  it('accepts score at minimum boundary (1)', () => {
    expect(isValidScore(1)).toBe(true);
  });
  
  it('accepts score at maximum boundary (100)', () => {
    expect(isValidScore(100)).toBe(true);
  });
  
  it('rejects score below minimum (0)', () => {
    expect(isValidScore(0)).toBe(false);
  });
  
  it('rejects score above maximum (101)', () => {
    expect(isValidScore(101)).toBe(false);
  });
});
```

### 戦略 F：状態を持つ操作のテスト（state / operations）
**適用対象**：仕様に `state` 定義と `operations` があるエージェント（作成・更新・削除・一覧 など）。`generate-code` は `state` をクラスに、操作をそのメソッドに変換するので、テストはクラスのインスタンスに対して書く
**テスト内容**：
- 初期状態（`init`）：新しいインスタンスが仕様の初期値になっているか
- 各操作の事後条件：戻り値、変わる部分、**変わらない部分**（他のレコード、カウンタなど。仕様で `x~` と書かれている「操作前の値」は、操作の前に読み取り専用アクセサからコピーして保持する）
- 状態の不変式：操作を何回か行った後も成り立っているかを、読み取り専用アクセサ経由で確かめる
- 事前条件違反：`ContractError` が発生し、**状態が変わっていない**こと
- 仕様に書かれた履歴に関する性質（例：削除したIDを再利用しない）

**書き方の規則**：
- テストごとに新しいインスタンスを作る（`const db = new UserDB()` を各 `it` の中、または `beforeEach` で）。インスタンスをテスト間で共有しない。
- 状態の読み取りは実装が公開している読み取り専用アクセサ（`db.users`、`db.nextId` など。実際の名前は `generated/` を読んで確かめる）で行い、private なフィールドに触れない。
- マップや集合の比較は、コピーを取ってから `toEqual`（`node:test` では `assert.deepEqual`）で行う。

```typescript
import { describe, it, expect } from 'vitest';
import { UserDB, ContractError } from '../generated/index.ts';

describe('UserDB - state and operations', () => {
  it('starts in the init state', () => {
    const db = new UserDB();                       // テストごとに新しいインスタンス
    expect(db.users.size).toBe(0);
    expect(db.nextId).toBe(1);
  });

  it('registerUser: RESULT = nextId~, nextId = nextId~ + 1, other entries unchanged', () => {
    const db = new UserDB();
    const first = db.registerUser('Aiko', 'aiko@example.com');
    const usersBefore = new Map(db.users);         // 操作前の状態（users~）
    const nextIdBefore = db.nextId;                // nextId~

    const id = db.registerUser('Ben', 'ben@example.com');

    expect(id).toBe(nextIdBefore);
    expect(db.nextId).toBe(nextIdBefore + 1);
    expect(db.users.size).toBe(usersBefore.size + 1);
    expect(db.users.get(first)).toEqual(usersBefore.get(first));
  });

  it('a rejected call throws ContractError and leaves the state unchanged', () => {
    const db = new UserDB();
    db.registerUser('Aiko', 'aiko@example.com');
    const usersBefore = new Map(db.users);
    const nextIdBefore = db.nextId;

    expect(() => db.removeUser(999)).toThrow(ContractError);

    expect(new Map(db.users)).toEqual(usersBefore);
    expect(db.nextId).toBe(nextIdBefore);
  });

  it('state invariant holds after each operation: every id in dom users is below nextId', () => {
    const db = new UserDB();
    const a = db.registerUser('Aiko', 'aiko@example.com');
    db.registerUser('Ben', 'ben@example.com');
    db.removeUser(a);
    for (const id of db.users.keys()) {
      expect(id).toBeLessThan(db.nextId);
    }
  });

  it('a removed id is not reused, even when the newest entry is removed', () => {
    const db = new UserDB();
    db.registerUser('Aiko', 'aiko@example.com');
    const newest = db.registerUser('Ben', 'ben@example.com');
    db.removeUser(newest);
    expect(db.registerUser('Chika', 'chika@example.com')).toBe(newest + 1);
  });
});
```

この例は `generate-code` の `references/typescript-rules.md` にある `UserDB` の例を対象にしたもので、Vitest 5.1.0 で実行して5件成功、`node:test` に書き換えたものと Jest（ts-jest）用に import を合わせたものも成功することを確認している（実測）。実際のテストは、対象の仕様のクラス名・操作名・条項から書く。

**選択ロジック**：
```
関数の特性 → 適用すべき戦略

1. 入力型が単純 → 戦略A（型値テスト）
2. 複雑な前提条件 → 戦略B（前提条件テスト）
3. 複雑な事後条件 → 戦略C（事後条件テスト）
4. プロトコル関連（PROTOCOL.md / API-SIGNATURES.md がある場合のみ） → 戦略D（プロトコルテスト）
5. 数値制約あり → 戦略E（境界値テスト）
6. state と operations がある → 戦略F（状態を持つ操作のテスト）

複数の戦略を組み合わせることも可能
（例：戦略A + B + E、戦略A + E + F）
```

## ステップ3：テストコード生成

**目的**：VDM-SL仕様をテストコードに自動変換

### import とランナー別の書き方（必ず守る）

- **実装を import する。再実装しない。** テスト対象は `generate-code` が出力した実装（仕様ファイルと同じディレクトリの `generated/`）。テストファイルの中に、検証関数やテスト対象のロジックを書き写したり作り直したりしない。import する名前は `generated/` のファイルを読んで、実在する export に合わせる（このスキルの例に出てくる `isValidScore`、`validateWsMessage` などは説明用の名前）。対応する export が無い条項は、テスト側で代用の実装を書かず、完了報告に「対応する実装なし」として挙げる。
- **パスの規則**：テストファイルから `generated/` への相対パスで、`index.ts`（無ければ該当モジュールのファイル）を**拡張子 `.ts` 付き**で import する。型だけの import は `import type` にする。この書き方はステップ0の (a)(b)(c) のどれでも動く（Vitest は拡張子の有無を問わず解決し、Node.js は拡張子を必須とする。どちらも実測）。既存プロジェクトに別の慣習がある場合（0b）はそちらに従う。
- **置き場所と名前**：既存の慣習が無ければ `<仕様ファイルのディレクトリ>/tests/<モジュール名の kebab-case>.test.ts`（例：モジュール `TaskManager` → `tests/task-manager.test.ts`。`generate-code` の実装ファイル `generated/task-manager.ts` と同じ名前にする）。このとき import 元は `'../generated/index.ts'` になる。既存のランナーがある場合の置き場所は 0b に従う。
- **参考テンプレートは任意**：テストはこの SKILL.md だけで書ける。`./references/test-templates.md` は条項の種類ごとの追加例（Vitest 形式、import 元と関数名は説明用）で、読まなくてよい。
- **契約違反の判定**：事前条件・不変条件の違反は、実装が export しているエラークラス（`generate-code` の出力では `ContractError`）で判定する。メッセージ文字列で照合する場合は、実装の実際のメッセージを読んでから書く。契約チェックは既定で有効。`VDM_CONTRACT_CHECK=off` で実行すると、事前条件違反を期待するテストは失敗する（実測）ので、テスト実行時に `off` にしない。
- **Jest の場合**：以降の例（Vitest 形式）と同じ `describe` / `it` / `expect` で書ける。Jest ではこれらがグローバルなので、既存テストが import していなければ import 行を書かない（既存テストが `@jest/globals` から import していればそれに合わせる）。実装の import の書き方は既存テストに合わせる（ts-jest での実測例は 0b を参照）。ts-jest はテストファイルも型チェックするので、契約違反を確かめるために型に合わない値をわざと渡す呼び出しは、そのままではコンパイルエラー（TS2345）になり、そのファイルのテストが1件も実行されない。`'Archived' as unknown as TaskStatus` のようにキャストして渡す（Jest 30.5.2 + ts-jest 29.4.15 + TypeScript 6.0.3 で実測）。テスト名での絞り込みは `npx jest <ファイル> -t "<名前>"`（Jest 30.5.2 で実測。`<名前>` は正規表現として解釈される。5a の「絞り込みコマンドの注意」を参照）。
- **アサーション**：ステップ0で決まったランナーに合わせる。以降の例は Vitest 形式。`node:test` の場合は次の対応で書き換える（`node:assert/strict` の比較は厳密比較）。

| Vitest / Jest | `node:test` + `node:assert/strict` |
|---|---|
| `import { describe, it, expect } from 'vitest'` | `import { describe, it } from 'node:test'` と `import assert from 'node:assert/strict'` |
| `expect(x).toBe(y)` | `assert.equal(x, y)` |
| `expect(x).toEqual(y)` | `assert.deepEqual(x, y)` |
| `expect(() => f()).toThrow()` | `assert.throws(() => f())` |
| `expect(() => f()).toThrow(ContractError)` | `assert.throws(() => f(), ContractError)` |
| `expect(() => f()).not.toThrow()` | `assert.doesNotThrow(() => f())` |
| `expect(() => f()).toThrow(/text/)` | `assert.throws(() => f(), /text/)` |
| `expect(xs).toContain(v)` | `assert.ok(xs.includes(v))` |
| `expect(xs).toHaveLength(n)` | `assert.equal(xs.length, n)` |
| `expect(x).toBeDefined()` | `assert.notEqual(x, undefined)` |
| `expect(x).toBeNull()` | `assert.equal(x, null)` |
| `expect(x).toBeGreaterThan(y)` / `toBeGreaterThanOrEqual(y)` | `assert.ok(x > y)` / `assert.ok(x >= y)` |
| `expect(x).toBeLessThan(y)` / `toBeLessThanOrEqual(y)` | `assert.ok(x < y)` / `assert.ok(x <= y)` |
| `expect(o).toHaveProperty('k')` | `assert.ok('k' in o)` |
| `expect(x).toBeInstanceOf(C)` | `assert.ok(x instanceof C)` |
| `expect(m).toEqual(expectedMap)`（`Map` / `Set`） | `assert.deepEqual(m, expectedMap)`（`Map` / `Set` も中身で比較される） |

この表の右列は、すべて Node.js v26.4.0 の `node --test` で実行して確認している（実測）。

### 3a. テスト構造の生成

```typescript
import { describe, it, expect } from 'vitest';
import {
  decide,
  scoreAll,
  explainDecision,
  validateTicket,
  ContractError
} from '../generated/index.ts';

// ============================================
// テストスイート1：型不変式テスト
// ============================================

describe('HybridJudgeAgent - Type Invariants', () => {
  // Score不変式のテスト
  describe('Score type (nat1, inv: 1 <= s <= 100)', () => {
    // テストケース...
  });
  
  // Threshold不変式のテスト
  describe('Threshold type (nat1, inv: 1 <= t <= 100)', () => {
    // テストケース...
  });
});

// ============================================
// テストスイート2：前提条件テスト
// ============================================

describe('HybridJudgeAgent - Preconditions', () => {
  describe('decide(ticket, t1, t2) precondition: t1 > t2', () => {
    // テストケース...
  });
});

// ============================================
// テストスイート3：事後条件テスト
// ============================================

describe('HybridJudgeAgent - Postconditions', () => {
  describe('decide(ticket, t1, t2) postcondition', () => {
    // テストケース...
  });
});

// ============================================
// テストスイート4：プロトコルテスト
// （PROTOCOL.md / API-SIGNATURES.md がある場合のみ。無ければこのスイートは書かない）
// ============================================

describe('MessageProtocol - Invariants', () => {
  // メッセージ型テスト...
});
```

ステップ0で (b) を選んだ場合は、同じ構造を `node:test` で書く：

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decide, ContractError } from '../generated/index.ts';
import type { Ticket } from '../generated/index.ts';

describe('HybridJudgeAgent - Preconditions', () => {
  describe('decide(ticket, t1, t2) precondition: t1 > t2', () => {
    const ticket: Ticket = { id: 1, complexity_score: 50 };

    it('succeeds when t1 (80) > t2 (20)', () => {
      assert.doesNotThrow(() => decide(ticket, 80, 20));
    });

    it('throws when t1 (20) < t2 (80)', () => {
      assert.throws(() => decide(ticket, 20, 80), ContractError);
    });
  });
});
```

### 3b. テストケースの生成

VDM-SL仕様から自動抽出したテストケース例：

```javascript
describe('decide function', () => {
  // 前提条件テストケース
  describe('precondition: t1 > t2', () => {
    it('succeeds when t1 (80) > t2 (20)', () => {
      const ticket = { 
        id: 1, 
        complexity_score: 50 
      };
      expect(() => decide(ticket, 80, 20)).not.toThrow();
    });
    
    it('throws when t1 (20) == t2 (20)', () => {
      const ticket = { id: 1, complexity_score: 50 };
      expect(() => decide(ticket, 20, 20)).toThrow(ContractError);
    });
    
    it('throws when t1 (20) < t2 (80)', () => {
      const ticket = { id: 1, complexity_score: 50 };
      expect(() => decide(ticket, 20, 80)).toThrow(ContractError);
    });
  });
  
  // 事後条件テストケース
  describe('postcondition: action determination', () => {
    const cases = [
      // [complexity_score, t1, t2, expectedAction]
      [90, 80, 20, 'OperatorOnly'],     // complexity > t1
      [50, 80, 20, 'OperatorAndLLM'],   // t2 < complexity <= t1
      [10, 80, 20, 'AutoReply'],        // complexity <= t2
      [80, 80, 20, 'OperatorAndLLM'],   // complexity == t1（エッジケース）
      [20, 80, 20, 'AutoReply'],        // complexity == t2（エッジケース）
    ];
    
    cases.forEach(([score, t1, t2, expected]) => {
      it(`returns ${expected} for complexity=${score}, t1=${t1}, t2=${t2}`, () => {
        const ticket = { id: 1, complexity_score: score };
        const result = decide(ticket, t1, t2);
        expect(result).toBe(expected);
      });
    });
  });
  
  // 境界値テスト
  describe('boundary values', () => {
    it('works with minimum score (1)', () => {
      const ticket = { id: 1, complexity_score: 1 };
      const result = decide(ticket, 80, 20);
      expect(result).toBe('AutoReply');
    });
    
    it('works with maximum score (100)', () => {
      const ticket = { id: 1, complexity_score: 100 };
      const result = decide(ticket, 80, 20);
      expect(result).toBe('OperatorOnly');
    });
  });
});
```

### 3c. 条項とテストの対応を確かめる（毎回）

テストを書き終えたら、仕様の条項を1つずつ数え、対応するテストがあるかを確かめる。`model-routing.json` の有無に関係なく毎回行う（実行して緑になるだけでは、条項を素通りする薄いスイートも通ってしまう）。

- 数える条項：型の不変式（`inv`）、状態の不変式、状態の初期値（`init`）、各関数・操作の `pre`、各 `post`。`inv`・`pre`・`post` はどれも、いちばん外側の `and` でつながった条件を1つずつ数える。`pre` の無い関数・操作の `pre` は0件。`inv` の付いていない型の制約（`nat1`、`seq1`、引用型の値の集合、レコードのフィールドの型）は、テストは書いてよいが、条項の数には入れない。設計文書がある場合は、状態遷移とペイロードの各規則も数える。
- 各条項に、それを破る実装では失敗するテストが少なくとも1つあること。`pre` は「満たす入力で成功する」と「破る入力で `ContractError` になる」の両方。数値や長さの上限・下限は、境界のちょうど内側と外側の両方。
- 対応するテストが無い条項には、テストを足す。足せない場合（対応する export が無い、など）は、その条項を完了報告に挙げる。
- 完了報告の「条項の対応」に `対応するテストがある条項の数 / 条項の総数` を書く。これは生成者自身による数え上げであり、テストの強さを測ったもの（ミューテーションテストなど）ではない。そのことも報告に書く。

## ステップ4：設計文書ベースのプロトコルテスト生成

**目的**：PROTOCOL.md および API-SIGNATURES.md に定義されたプロトコル契約とAPI契約の正確性をテスト

**PROTOCOL.md と API-SIGNATURES.md のどちらも無い場合は、このステップ全体をスキップする**（単独のエージェントの仕様では普通のこと）。存在しない文書の内容を想定してテストを書かず、完了報告の「生成しなかったテスト」に1行で書く。

### プロトコル設計文書（PROTOCOL.md）の構造例

PROTOCOL.md は Markdown 形式で以下の情報を含む設計文書です：

````markdown
# WsMessage Protocol Specification

## Message Types

| Message Type | Direction | Payload Type | Description |
|-------------|-----------|--------------|-------------|
| TicketCreate | client→server | TicketCreatePayload | ユーザーがチケットを作成 |
| TicketCreated | server→client | TicketCreatedPayload | サーバーが作成確認 |
| AutoReply | server→client | AutoReplyPayload | 自動返信を送信 |
| Escalation | server→client | EscalationPayload | エスカレーションを通知 |

## State Transitions

```
Created → Assigned → InProgress → Resolved → Closed
         ↓ ↓
       ├─ Closed
```

## API Signatures (shared)

All API handlers must match these signatures:
- `processMessage(msg: WsMessage) -> Promise<Result>`
- `validatePayload(payload: any) -> boolean`
- `getMessageType(msg: WsMessage) -> MessageType`
````

このスキルは上記の設計文書をパースして、対応するテストを自動生成します。

### 4a. メッセージ型整合性テスト（設計文書から生成）

PROTOCOL.md の Message Types テーブルをパースして生成されるテスト：

```javascript
describe('WsMessage protocol layer (from PROTOCOL.md)', () => {
  describe('Message type and payload consistency', () => {
    // PROTOCOL.md のメッセージ定義テーブルから自動生成
    // 各メッセージ型について、指定されたペイロード型を持つことを検証
    
    it('TicketCreate message (client→server) has TicketCreatePayload', () => {
      const msg = {
        msg_type: 'TicketCreate',
        payload: { customer_id: 1, title: 'Test' },
        timestamp: Date.now()
      };
      // PROTOCOL.mdに定義されたペイロード構造を検証
      expect(validateWsMessage(msg)).toBe(true);
    });
    
    it('rejects TicketCreate with wrong payload (contract violation)', () => {
      const msg = {
        msg_type: 'TicketCreate',
        payload: { ticket_id: 1, reason: 'wrong' },  // EscalationPayload
        timestamp: Date.now()
      };
      // PROTOCOL.mdで指定されたペイロード型と不整合
      expect(validateWsMessage(msg)).toBe(false);
    });
    
    it('AutoReply message (server→client) has AutoReplyPayload', () => {
      const msg = {
        msg_type: 'AutoReply',
        payload: { ticket_id: 1, reply_text: 'Got it' },
        timestamp: Date.now()
      };
      // PROTOCOL.mdに定義されたペイロード構造を検証
      expect(validateWsMessage(msg)).toBe(true);
    });
    
    // ... PROTOCOL.mdに定義されたすべてのメッセージ型の組み合わせ
  });
  
  // 方向判定関数のテスト（PROTOCOL.mdのDirectionカラムから生成）
  describe('Direction validation (from PROTOCOL.md)', () => {
    it('TicketCreate is client→server per PROTOCOL.md', () => {
      const msg = { msg_type: 'TicketCreate' };
      expect(isClientToServer(msg)).toBe(true);
    });
    
    it('AutoReply is server→client per PROTOCOL.md', () => {
      const msg = { msg_type: 'AutoReply' };
      expect(isClientToServer(msg)).toBe(false);
    });
    
    it('rejects message from wrong direction', () => {
      const msg = { msg_type: 'TicketCreate' };
      // PROTOCOL.mdでclient→serverと指定されているが、
      // serverから送信しようとする
      expect(isValidDirection('server', msg)).toBe(false);
    });
  });
});
```

### 4b. 状態遷移テスト（設計文書から生成）

PROTOCOL.md の State Transitions セクションをパースして生成されるテスト：

```javascript
describe('TicketStatus state transitions (from PROTOCOL.md)', () => {
  describe('validTransition function - contract compliance', () => {
    // PROTOCOL.mdで定義された有効な遷移
    // 設計文書と実装の一貫性を検証（コントラクトテスト）
    const validTransitions = [
      ['Created', 'Assigned'],
      ['Created', 'Closed'],
      ['Assigned', 'InProgress'],
      ['Assigned', 'Closed'],
      ['InProgress', 'Resolved'],
      ['InProgress', 'Closed'],
      ['Resolved', 'Closed'],
    ];
    
    validTransitions.forEach(([from, to]) => {
      it(`allows ${from} -> ${to} (PROTOCOL.md定義)`, () => {
        expect(validTransition(from, to)).toBe(true);
      });
    });
    
    // PROTOCOL.mdに定義されていない無効な遷移
    const invalidTransitions = [
      ['Created', 'InProgress'],
      ['Created', 'Resolved'],
      ['Assigned', 'Created'],
      ['InProgress', 'Assigned'],
      ['Resolved', 'InProgress'],
      ['Closed', 'Created'],
      ['Closed', 'Closed'],   // Closed は終了状態。自分自身への遷移も定義されていない
    ];
    
    invalidTransitions.forEach(([from, to]) => {
      it(`rejects ${from} -> ${to} (PROTOCOL.md違反)`, () => {
        expect(validTransition(from, to)).toBe(false);
      });
    });
  });
  
  // 到達可能性テスト（PROTOCOL.mdの状態遷移図から導出）
  describe('reachability (state diagram from PROTOCOL.md)', () => {
    it('all states are reachable from Created per PROTOCOL.md', () => {
      // PROTOCOL.mdの状態遷移図に従い、初期状態から全状態への到達可能性を検証
      const reachable = computeReachable('Created');
      expect(reachable).toContain('Created');
      expect(reachable).toContain('Assigned');
      expect(reachable).toContain('InProgress');
      expect(reachable).toContain('Resolved');
      expect(reachable).toContain('Closed');
    });
  });
});
```

### 4c. 複合プロトコルテスト（設計文書ベース）

PROTOCOL.md全体の整合性を検証する統合テスト：

```javascript
describe('Hybrid protocol scenario (from PROTOCOL.md)', () => {
  it('complete ticket lifecycle respects PROTOCOL.md contract', () => {
    // ユーザーがチケットを作成（PROTOCOL.mdで client→server と定義）
    const createMsg = {
      msg_type: 'TicketCreate',
      payload: { customer_id: 1, title: 'Bug' },
      timestamp: 1000
    };
    expect(isClientToServer(createMsg)).toBe(true);
    expect(validateWsMessage(createMsg)).toBe(true);
    
    // サーバーがチケットを確認応答（PROTOCOL.mdで server→client と定義）
    const createdMsg = {
      msg_type: 'TicketCreated',
      payload: { ticket_id: 100, status: 'Created' },
      timestamp: 1001
    };
    expect(isServerToClient(createdMsg)).toBe(true);
    expect(validateWsMessage(createdMsg)).toBe(true);
    
    // ステータスが PROTOCOL.md の状態遷移図に従って遷移
    expect(validTransition('Created', 'Assigned')).toBe(true);
    expect(validTransition('Assigned', 'InProgress')).toBe(true);
    expect(validTransition('InProgress', 'Resolved')).toBe(true);
    expect(validTransition('Resolved', 'Closed')).toBe(true);
  });
});
```

### 4d. 共有API署名テスト（API-SIGNATURES.mdから生成）

API-SIGNATURES.md に定義された共有API契約を検証：

```javascript
describe('Shared API signatures (from API-SIGNATURES.md)', () => {
  describe('Common handler interface compliance', () => {
    // API-SIGNATURES.mdで定義された関数シグネチャを実装が満たすか検証
    
    it('processMessage(msg) returns Promise<Result>', async () => {
      const handler = getMessageHandler('TicketCreate');
      const msg = { msg_type: 'TicketCreate', payload: { customer_id: 1 } };
      
      const result = handler.processMessage(msg);
      expect(result).toBeInstanceOf(Promise);
      
      const resolved = await result;
      expect(resolved).toHaveProperty('status');
      expect(resolved).toHaveProperty('data');
    });
    
    it('validatePayload(payload) returns boolean', () => {
      const handler = getMessageHandler('TicketCreate');
      const validPayload = { customer_id: 1, title: 'Test' };
      const invalidPayload = { wrong: 'fields' };
      
      expect(handler.validatePayload(validPayload)).toBe(true);
      expect(handler.validatePayload(invalidPayload)).toBe(false);
    });
    
    it('getMessageType(msg) returns MessageType string', () => {
      const handler = getMessageHandler('TicketCreate');
      const msg = { msg_type: 'TicketCreate', payload: {} };
      
      const msgType = handler.getMessageType(msg);
      expect(typeof msgType).toBe('string');
      expect(['TicketCreate', 'AutoReply', 'Escalation']).toContain(msgType);
    });
  });
});
```

## ステップ5：生成後の指導

**目的**：開発者がテストを実装に統合できるようサポート

### 5a. 完了報告（必須）

フェーズの最後に、次の項目をすべて含む報告を必ず出す。値は実際に書いたファイルと実際の実行結果から埋める。実行していないコマンドの結果や件数を書かない。

```text
契約テスト生成：完了報告
- 生成したファイル: <作成・上書きしたファイルのパス>
- ランナー: <Vitest | Jest | Mocha | node:test>（<既存のものを使用 | ステップ0で (a) / (b) / (c) を選択>）
- 実行ディレクトリ: <絶対パス>
- 実行コマンド: <コマンド1つ。例: npm test（(a) の場合） / npx jest <生成したファイル>（既存の Jest を使う場合）>
- 実行結果: <N件実行・N件成功・N件失敗（上記コマンドを実行して確認） | 未実行（理由）>
- 条項の対応: <対応するテストがある条項の数>/<条項の総数>（生成者による数え上げ。テストの強さの測定ではない）。対応するテストが無い条項: <一覧 | なし>
- 生成しなかったテスト: <例: PROTOCOL.md / API-SIGNATURES.md が無いためプロトコルテストは未生成 | なし>
- 対応する実装なし: <実装に export が見つからなかった条項 | なし>
- 契約違反の例: <事前条件を破る呼び出し1つ> → <エラークラス名>: <メッセージ>（<実行して確認 | 実装のソースから転記。未実行>）。このテストだけを実行: <絞り込みコマンド（実行して、対象のテストが1件以上動いたことを確かめたもの） | 未確認のため省略>。エラーを表示するコマンド: <1行のコマンド | この環境では用意できない>
- 位置づけ: これらのテストはLLMが仕様から導いた有限個のケースであり、すべて成功しても仕様の機械検証にはならない。
- 仕様の機械検証（VDMJ）は未実行。必要なら verify-spec スキルで実行できる（任意。Javaが必要）。
```

`< >` は実際の値に置き換える。出力する報告にプレースホルダを残さない。既存のランナーを使った場合（0b）は、「実行結果」の次に `- 既存のテストコマンド（<npm test など>）の対象: <含まれる | 含まれない | 未確認>` の行を加える。

- **生成したファイル**：作成・上書きしたファイルをすべて挙げる（(a) で作った `package.json` と `package-lock.json` も含む。`node_modules/` ができたことも書く）。
- **ランナー**：使ったランナーと、既存のものか、ステップ0のどの選択肢で用意したものか。
- **実行ディレクトリと実行コマンド**：コマンドは1つだけ、コピーしてそのまま動く形で書く。どのディレクトリで実行するかを必ず添える。`node:test` の場合は「別のディレクトリで実行すると0件・終了コード0になるので、出力の `tests` が0でないことを確認する」と添える。
- **実行する条件**：ステップ0で (a) または (b) を選んだ場合も、既存ランナーを使う場合（0b）も、ユーザーが断らない限り、このコマンドを自分で実行してから報告する。0b では生成したテストファイルだけを対象にする。(c) の場合や実行できなかった場合は、実行結果を「未実行」と書き、理由と実行に必要なものを添える。
- **実行結果**：ランナーの出力から件数（実行・成功・失敗）を写す。0件実行は成功ではない。失敗があればテスト名を列挙し、原因が実装の `TODO` スタブ（`generate-code` が残した手動実装箇所）なのか、実装と仕様の乖離なのかを分けて書く。緑にするためにテストを弱めたり、削除・スキップしたりしない。
- **条項の対応**：3c で数えた値を書く。対応するテストが無い条項があれば名前を挙げる。
- **生成しなかったテスト／対応する実装なし**：該当が無ければ「なし」と書く（行を省かない）。
- **既存のテストコマンドの対象**（0b のみ）：`npx jest --listTests` や `npx vitest list --filesOnly` の出力に生成したファイルがあるかで判断する。確かめていなければ「未確認」と書く。プロジェクト全体のテストを無断で実行して確かめない。
- **契約違反の例**：最初に動かしたユーザーが、契約が効いていることを自分の目で確かめられるようにする。生成したテストの中から事前条件を破る呼び出しを1つ選び、その呼び出し式・発生するエラークラス（`generate-code` の出力では `ContractError`）・メッセージを書く。メッセージは、実際に実行して得たものか、実装のソースにある文言を写したものに限る（どちらなのかを書く。推測で書かない）。事前条件を持つ関数・操作が仕様に無い場合は「なし」と書く。
  - **このテストだけを実行**：そのテストだけを実行する絞り込みコマンドを、下の表と「絞り込みコマンドの注意」に従って作る。絞り込みの引数は正規表現として解釈され、一致が0件でも終了コードは0になるので、**報告に書く前に自分で実行し、対象のテストが1件以上実行されたことを出力で確かめる**。確かめていないコマンドは書かず、「未確認のため省略」と書く（(c) を選んだ場合など）。このコマンドの出力は成功・スキップの件数だけで、エラーの文言は表示されない。
  - **エラーを表示するコマンド**：0c で (b) を「この環境で使えます」と判定できる条件（`process.features.typescript` が `strip`、`"type": "commonjs"` でない、実装が拡張子 `.ts` 付きの import）を満たす場合は、次の形の1行を実行ディレクトリで自分で実行し、表示された行（`ContractError: ...`）を上の「メッセージ」に写したうえで、同じコマンドを報告に書く。ユーザーがコピーして実行すると、`package.json` が無い場合と `"type": "module"` の場合は、エラーの1行だけが表示される。`package.json` があって `"type"` が書かれていない場合は、同じ1行の前に Node.js の警告（`MODULE_TYPELESS_PACKAGE_JSON`）が数行表示される（どちらも Node.js v26.4.0 で実測。名前は実際の export に置き換える。`try` / `catch` を外すと、同じエラーがスタックトレース付きで表示され、終了コードは1になる）：
    `node --input-type=module -e "import { UserDB } from './generated/index.ts'; try { new UserDB().removeUser(999); console.log('no error'); } catch (e) { console.log(e.name + ': ' + e.message); }"`
    条件を満たさない場合（例：`"type": "commonjs"` の既存プロジェクト）は、このコマンドは動かない（実測）ので書かず、「この環境では用意できない」と書く。
- **位置づけ**：上の1行を毎回入れる。
- **VDMJの行**：仕様ファイルの隣（`verification.json`、`evidence/` など）にも、この会話の中にも `verify-spec`（VDMJ）の実行結果が無ければ、「仕様の機械検証（VDMJ）は未実行」と書き、任意の次のステップとして `verify-spec`（Javaが必要）を挙げる。実行結果がある場合は、その場所を示す（言い換えて「検証済み」とだけ書かない）。記録された入力ハッシュが現在の仕様と一致しない結果は、古い結果として扱う（`../verify-spec/references/verification-results.md`）。

テスト名で絞り込むコマンドは、完了報告に書いた実行コマンドに、ランナーごとのフラグを足して作る：

| 完了報告に書いた実行コマンド | 絞り込みの例 |
|---|---|
| `npm test`（(a) で `scripts.test` が `vitest run` の場合） | `npm test -- -t "Type Invariants"` |
| `npx vitest run <生成したファイル>`（既存の Vitest を使う場合） | `npx vitest run <生成したファイル> -t "Type Invariants"` |
| `npx jest <生成したファイル>`（既存の Jest を使う場合） | `npx jest <生成したファイル> -t "Type Invariants"` |
| Mocha のコマンド | `--grep "Type Invariants"` を足す（`npm test` なら `npm test -- --grep "Type Invariants"`） |
| `node --test "tests/**/*.test.ts"` | `node --test --test-name-pattern="Type Invariants" "tests/**/*.test.ts"` |

既存のランナーを使う場合（0b）は、絞り込みにも `npm test -- -t ...` を使わない。プロジェクトの他のテストファイルまで対象になる（Jest 30.5.2 で実測）。

**絞り込みコマンドの注意**（Vitest 5.1.0、Jest 30.5.2、Node.js v26.4.0 で実測。Mocha は未実測なので、同じ注意で扱い、実行して確かめる）：

- `-t` と `--test-name-pattern` の引数は、テスト名に対する正規表現として解釈される。テスト名に `(` `)` `[` `]` `{` `}` `.` `*` `+` `?` `|` `^` `$` `\` が含まれていると、名前をそのまま渡しても一致しないことがある。例：`describe('deleteTask(id) precondition: id in set dom tasks', ...)` に対して `-t "deleteTask(id) precondition"` は1件も一致しない。
- 一致が0件でも終了コードは0になる。Vitest と Jest は全件が `skipped` と表示される。`node --test` は `tests 1`・`suites 0`・`pass 1` と表示される（テストファイルそのものが1件と数えられる）。どちらも「そのテストが成功した」ことを意味しない。
- 記号を含まない部分文字列を使う（`-t "deleteTask"`。同じ文字列を名前に含む他のテストも一緒に実行される）か、記号を `\` でエスケープする（`-t "deleteTask\(id\) precondition"`）。
- 作ったコマンドは報告に書く前に実行し、対象のテストが実際に動いたことを出力で確かめる。Vitest と Jest は `passed` が1件以上あること（全件 `skipped` は一致なし）。`node --test` は出力に対象のテスト名が表示されていること（`suites 0` は一致なし）。

### 5b. テストカバレッジ確認

カバレッジ測定は任意で、ステップ0の最小構成には含まれない。Vitest の `--coverage` は追加パッケージ（`@vitest/coverage-v8`）が無いと失敗する（Vitest 5.1.0 で実測）。追加のインストールはユーザーの同意を得てから行う。以下は出力のイメージであり、実測値ではない。

```
テストカバレッジレポート
=======================

ファイル: HybridJudgeAgent.js
行カバレッジ: 95%（57/60行）
分岐カバレッジ: 100%（12/12分岐）
関数カバレッジ: 100%（5/5関数）

行カバレッジ：
  ✓ 1-23行（型定義）: 100%
  ✓ 24-45行（decide関数）: 100%
  ✓ 46-60行（補助関数）: 85%（警告：1行未カバー）

警告：
  ⚠️ 60行目（explainDecision内の未知アクション処理）が未テスト
     修正：新しいアクション型を追加した場合、対応するテストケースを追加してください
```

### 5c. 失敗テストの解釈ガイド

```javascript
// テスト失敗例：
// ❌ decide function postcondition - returns OperatorOnly when complexity > t1
//    Expected: "OperatorOnly"
//    Received: "OperatorAndLLM"

// デバッグ手順：
// 1. 前提条件を確認：t1 > t2 が満たされているか？
console.log('t1:', 80, 't2:', 20, 't1 > t2:', 80 > 20); // true

// 2. 入力を確認：complexity_score の値は何か？
const ticket = { complexity_score: 50 };
console.log('complexity_score:', ticket.complexity_score);
console.log('complexity > t1:', 50 > 80); // false
console.log('t2 < complexity <= t1:', 20 < 50 && 50 <= 80); // true

// 3. 実装ロジックを確認
function decide(ticket, t1, t2) {
  if (ticket.complexity_score > t1) {
    return 'OperatorOnly';
  } else if (ticket.complexity_score > t2) {
    return 'OperatorAndLLM';  // ✓ この分岐が正しい
  } else {
    return 'AutoReply';
  }
}
// 実装は正しい。テストケースを再確認してください。
```

### 5d. テストメンテナンスガイド

```javascript
// ❌ 悪い例：ハードコードされた値
it('returns OperatorOnly for high complexity', () => {
  const ticket = { complexity_score: 95 };
  const result = decide(ticket, 80, 20);
  expect(result).toBe('OperatorOnly');
});

// ✓ 良い例：テストケース定義の集約化
const testCases = [
  { score: 95, t1: 80, t2: 20, expected: 'OperatorOnly' },
  { score: 50, t1: 80, t2: 20, expected: 'OperatorAndLLM' },
  { score: 10, t1: 80, t2: 20, expected: 'AutoReply' },
];

testCases.forEach(({ score, t1, t2, expected }) => {
  it(`returns ${expected} for score=${score}`, () => {
    const ticket = { complexity_score: score };
    const result = decide(ticket, t1, t2);
    expect(result).toBe(expected);
  });
});

// VDM-SL仕様が変更された場合、テストケースを一箇所で更新すれば全テストが更新される
```

## VDM-SL → テスト変換リファレンス

| VDM-SL要素 | テスト手法 | 生成されるテストコード例 |
|-----------|---------|----------------------|
| `inv s == s >= 1 and s <= 100` | 境界値テスト | `isValidScore(0)`, `isValidScore(1)`, `isValidScore(100)`, `isValidScore(101)` |
| `pre x > 0`（f の pre 節） | 前提条件テスト | `expect(() => f(-1)).toThrow(ContractError)` |
| `post RESULT > 0`（f の post 節） | 事後条件テスト | `expect(f(x)).toBeGreaterThan(0)` |
| `Action = <A> \| <B> \| <C>` | 全値テスト | 各アクション型で別テストケース |
| `validTransition(current, next)` | 遷移テスト | `expect(validTransition('A', 'B')).toBe(true/false)` |
| `map T1 to T2` | マップ操作テスト | キー存在確認、値取得、更新テスト |
| `state S of ... init ...` | 初期状態テスト（戦略F） | `expect(new S().nextId).toBe(1)` |
| 操作の `post` にある `x~`（操作前の値） | 状態の事後条件テスト（戦略F） | 操作の前にコピーを取り、操作の後の値と比べる |

## バグ検出パターンと対策

| VDM-SL要素 | 想定バグ | テスト |
|-----------|--------|------|
| 不変式 | 常に真/偽のバグ | 型値テスト |
| 前提条件 | チェック漏れ | 前提条件テスト |
| 事後条件 | ロジック誤り | 事後条件テスト＋境界値 |
| Quote型の定義 | メッセージ型追加漏れ | メッセージ型カバレッジ |
| 状態遷移 | 無効遷移を許可 | 状態遷移テスト |
| 方向判定 | 双方向メッセージを許可 | 方向判定テスト |

## CIでの実行

CIでは、完了報告（5a）の「実行ディレクトリ」で「実行コマンド」をそのまま実行する。ステップ0で (a) を選んだ場合は、その前に依存のインストール（`npm ci`）が必要。
CIの Node.js にもステップ0と同じ条件が当てはまる（(b) の場合は、型ストリッピングが既定で有効なバージョン）。
このプラグインはCI設定ファイルを同梱しない。ワークフローを書くときは、対象リポジトリに実在するスクリプトとファイルだけを参照する。

## トラブルシューティング

### Q: テストが多すぎて実行時間が長い
**A**: テスト名で絞り込んでください。完了報告の実行コマンドに、ランナーごとのフラグを足します（5a の表と「絞り込みコマンドの注意」を参照。引数は正規表現として解釈されます）：
```bash
# Vitest（実行コマンドが npm test の場合）
npm test -- -t "postcondition"

# 既存の Vitest / Jest（生成したファイルだけを対象にする）
npx vitest run <生成したファイル> -t "postcondition"
npx jest <生成したファイル> -t "postcondition"

# Mocha
npm test -- --grep "postcondition"

# node:test
node --test --test-name-pattern="postcondition" "tests/**/*.test.ts"
```

### Q: テストが常に成功してしまう
**A**: テストが検証実装と一致していない可能性があります：
```javascript
// ❌ 悪い例：いつも成功する
it('decide returns Action', () => {
  const result = decide(ticket, 80, 20);
  expect(result).toBeDefined();  // 常に真
});

// ✓ 良い例：仕様を厳密に検証
it('decide returns OperatorOnly when score > t1', () => {
  const ticket = { complexity_score: 90 };
  const result = decide(ticket, 80, 20);
  expect(result).toBe('OperatorOnly');  // 具体的な値を期待
});
```

### Q: プロトコルテストでメッセージ型が追加されたのにテストが失敗する
**A**: PROTOCOL.md を更新してからテストを再生成してください：
```text
更新した PROTOCOL.md と API-SIGNATURES.md、および対象 .vdmsl を指定して
この generate-tests スキルを再実行する。その後、対象プロジェクトに
実在するテストコマンドを確認して実行する。
```

このプラグインには汎用の `scripts/generate-tests.js` や `npm run regenerate-tests` は同梱されていません。利用先が独自に定義したスクリプトは、その内容を確認してから使用します。

**重要**: プロトコルテストはPROTOCOL.md の内容に従います。VDM-SL仕様の変更ではなく、 PROTOCOL.md を更新することがプロトコルテストの同期につながります。

## 参考資料

- テンプレート集（任意の追加例。この SKILL.md だけでテストは書ける）：`./references/test-templates.md`
- Vitest ドキュメント：[https://vitest.dev](https://vitest.dev)
- Node.js テストランナー：[https://nodejs.org/api/test.html](https://nodejs.org/api/test.html)
- Node.js の TypeScript 実行（型ストリッピング）：[https://nodejs.org/api/typescript.html](https://nodejs.org/api/typescript.html)
- コード生成スキル：`../generate-code/SKILL.md`
- VDM-SL型変換リファレンス：本ドキュメント内の表を参照
- 仕様検証スキル：`../verify-spec/SKILL.md`
- 仕様定義スキル：`../define-contract/SKILL.md`

