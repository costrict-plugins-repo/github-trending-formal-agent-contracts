---
name: define-contract
description: >
  マルチエージェント開発におけるエージェント間契約をVDM-SLで定義して `.vdmsl` ファイルに保存し、
  エージェント間の通信がある場合は設計文書（PROTOCOL.md、API-SIGNATURES.md）も生成する。
  Javaは不要（仕様の機械検証は verify-spec で別途行う。任意）。
  「エージェントの契約を定義したい」「エージェント間のインターフェースを仕様化したい」
  「契約を書きたい」「仕様を作りたい」「エージェントの入出力を定義したい」
  「新しいエージェントを追加したい」「APIの仕様を形式的に書きたい」
  「プロトコル仕様を作りたい」といったリクエストに使用する。
  English triggers: "define an agent contract", "formalize the agent interface",
  "write a formal spec", "specify agent inputs and outputs", "design the protocol".
  形式手法の知識がないユーザーでも対話的に契約を定義できるよう、
  自然言語から段階的にVDM-SL仕様と設計文書へ変換する。
metadata:
  version: "2.1.0"
  author: Formal Agent Contracts
  tags: [vdm-sl, formal-specification, agent-contracts, protocol-design]
---

# エージェント契約定義スキル

形式的エージェント契約を段階的に定義し、VDM-SL（Vienna Development Method Specification Language）仕様を `.vdmsl` ファイルとして生成するスキルです。複数エージェント間の通信がある場合は、設計文書（PROTOCOL.md、API-SIGNATURES.md）も生成します。Javaは不要です。Phase 1（ドメイン論理）の VDM-SL 仕様に加えて、Phase 2（プロトコル・API 仕様）の設計文書生成に対応し、複雑なマルチエージェントシステムに対応しています。

## 概要

このスキルは以下のワークフローを実行します：

1. **ステップ1：エージェントロール抽出** - 対象エージェントの責務と境界を明確化
2. **ステップ2：データ型定義** - エージェントが扱うデータ構造を形式化（Phase 1: ドメイン論理）
2b. **ステップ2b：通信プロトコル層定義**（複数エージェント間の通信がある場合のみ） - 設計文書（PROTOCOL.md、API-SIGNATURES.md）を生成（Phase 2: プロトコル・API仕様）
3. **ステップ3：契約定義** - 前提条件と事後条件を含む契約を記述（Phase 1: ドメイン論理）
4. **ステップ4：VDM-SL生成** - Phase 1 VDM-SL仕様書を生成し、`.vdmsl` ファイルに保存
5. **ステップ5：仕様レビュー** - 生成された仕様（と、作成した場合は設計文書）を読み直して確認
6. **ステップ6：完了報告と次のステップ** - 保存先・決めたこと・検証の位置づけを報告し、次のプロンプト（コード生成 → 契約テスト生成）を案内

### 進め方の原則（必ず守る）

- **まず読む。足りないものだけ聞く**：各ステップに挙げた項目は、まずユーザーの依頼文・会話・ワークスペースの既存ファイルから読み取る。読み取れた項目は質問しない。
- **質問は1回にまとめる**：読み取れず、かつ仕様の内容を左右する項目だけを、AskUserQuestion で**1回に**まとめて確認する（1回に収まらない分は既定値で進める）。各項目に推奨の既定値を付け、専門用語（不変式・事前条件・事後条件・ステートフル・サイドエフェクト・異常系 など）を使わず平易な言葉で聞く。例：「削除したIDを後で再利用しますか？（推奨：しない）」「同じタイトルのタスクを複数作れますか？（推奨：作れる）」。エージェント名や保存先のように、既定値で困らない項目のためだけに質問しない。1回の質問に入りきらないときは、仕様と生成されるコードの公開APIを大きく左右するものから聞く：(1) 用意する操作、(2) IDの再利用、(3) 状態の変更の制限、(4) 重複の可否。残り（作成直後の初期値、一覧の並び順、長さの数え方 など）は既定値で決めて「決めたこと」に書く。
- **聞かずに決めたことは見せる**：ユーザーが「おまかせ」と答えた項目や、質問せずに既定値で決めた項目を、黙って仕様に埋め込まない。完了報告（ステップ6）の「決めたこと」に列挙し、ユーザーが訂正できるようにする。
- **Javaは不要**：このスキルは仕様を書くだけで、VDMJ（Java）を実行しない。したがって、書いた仕様は構文チェックも型チェックもされていない。完了報告に必ずそう書く。機械検証は `verify-spec` スキル（任意。Javaが必要）で行う。

## ステップ1：エージェントロール抽出

**目的**：対象エージェントの明確な責務定義

次の情報を整理します（依頼文と会話から読み取り、読み取れないものだけ「進め方の原則」に従って確認する）：

- **エージェント名**：e.g., `HybridJudgeAgent`, `MessageValidator`。指定が無ければ、責務から PascalCase の英語名を付ける（例：タスク管理 → `TaskManager`）。VDM-SL のモジュール名とファイル名になる
- **主要責務**：このエージェントが何をするか（1-2文）
- **入力の形態**：どのようなデータを受け取るか
- **出力の形態**：どのようなデータを返すか
- **状態管理**：ステートレスか、ステートフルか。呼び出しをまたいで覚えておくデータ（登録済みのタスクの一覧、次に発行するID など）があればステートフル。この用語のままユーザーに尋ねず、依頼内容（作成・更新・削除・一覧 などがあるか）から判断する
- **外部依存**：他のエージェントやシステムへの依存関係。他のエージェントとメッセージをやり取りしない単独のエージェントなら、ステップ2bは実施しない

**ステートフルなエージェントの書き方**：VDM-SL の `state` 定義と `operations`（操作）で書く（ステップ3の例、`references/contract-templates.md` のパターン2）。後続の `generate-code` は `state` をクラスに、操作をそのメソッドに変換する。ステートレスなエージェントは `functions`（関数）で書く。

**出力例**：
```
エージェント：HybridJudgeAgent
責務：チケットの自動返信可否を判定し、処理方法（自動応答/オペレータ連携/オペレータのみ）を決定する
入力：Ticket型（ID、本文、顧客情報、優先度、複雑度スコア）
出力：Action型（<AutoReply> | <OperatorAndLLM> | <OperatorOnly>）
状態：ステートレス（判定時点の入力値のみに依存）
依存：MessageValidator（メッセージ検証）、ScoreCalculator（スコア計算）
```

## ステップ2：データ型定義

**目的**：エージェントが扱う全データ型を形式化

以下の形式でデータ型を定義します（`types` の見出しの下に書き、定義は `;` で区切る）：

```vdm-sl
types

-- 基本型（不変式つき）：1から100までのスコア
Score = nat1
inv s == s <= 100;

-- 引用型（列挙）
Priority = <Low> | <Medium> | <High>;

-- レコード型
Ticket ::
  id               : nat1
  content          : seq1 of char
  priority         : Priority
  complexity_score : Score;
```

各型について以下を明確にします：

- **型の名前と分類**（基本型、レコード型、合成型）
- **不変式（invariant）**：型が満たすべき制約
- **値域**：取り得る値の範囲
- **デフォルト値**：必要に応じて定義
- **引用型の値の名前**：ユーザーが日本語などで挙げた値（例：未着手・進行中・完了）は、英語の PascalCase の引用型にする（例：`<NotStarted> | <InProgress> | <Done>`）。元の言葉は仕様のコメントに残し、対応（未着手 = `NotStarted` など）を完了報告の「決めたこと」に書く。この名前は、生成されるコードでユーザーが書く文字列の値（`'NotStarted'`）になる

**確認する観点**（依頼文から読み取る。読み取れず、仕様を左右するものだけ「進め方の原則」に従って確認する）：
- このエージェントが扱うデータは何か（例：タスクには ID・タイトル・ステータスがある）
- 各データにどのような制約があるか（例：スコアは1〜100、優先度は3値、タイトルは1文字以上100文字以下）
- 常に成り立っていなければならない関係はあるか（不変式。例：表のキーとレコードのIDが一致する）

## ステップ2b：通信プロトコル層定義

**目的**：マルチエージェント間の通信仕様を設計文書として形式化

**このステップは、複数のエージェント間に通信がある場合だけ実施します。** 単独のエージェント（他のエージェントとメッセージをやり取りしない）の場合はスキップし、PROTOCOL.md / API-SIGNATURES.md を作りません（空のファイルも作らない）。スキップしたことは完了報告（ステップ6）に1行で書きます。以降のステップで PROTOCOL.md / API-SIGNATURES.md に触れている箇所は、すべて「このステップを実施した場合」の話です。

ここで生成される成果物は **PROTOCOL.md** と **API-SIGNATURES.md** という設計ドキュメントであり、VDM-SL コードではありません。これらの文書はプロトコル実装エージェントと API 実装エージェントが直接参照します。

### 2b-1. メッセージ型レジストリ

全てのメッセージ型を正規名として宣言。Markdown テーブル形式で記録：

| メッセージ型（正規名） | 送信元 | 受信先 | 同期/非同期 | 説明 |
|---|---|---|---|---|
| `TicketCreate` | User | Server | 同期 | ユーザーがチケットを作成 |
| `TicketUpdate` | User | Server | 同期 | ユーザーがチケットを更新 |
| `EscalationRequest` | User | Server | 同期 | ユーザーがエスカレーションをリクエスト |
| `ReplyManual` | Operator | Server | 同期 | オペレータが手動返信 |
| `TicketCreated` | Server | User | 非同期 | サーバーがチケット作成完了を通知 |
| `AutoReply` | Server | User | 非同期 | サーバーが自動返信を送信 |
| `OperatorReply` | Server | User | 非同期 | サーバーがオペレータからの返信を転送 |

**定義時のチェックポイント**：
- 各メッセージ型は固有で明確か？
- メッセージの方向（送信元→受信先）が明記されているか？
- 同期/非同期の区別が適切か？

### 2b-2. ペイロード構造仕様

各メッセージ型のペイロード（データ本体）をフィールド定義テーブルで記述：

#### TicketCreate ペイロード

| フィールド名 | 型 | 必須/省略可 | 説明 |
|---|---|---|---|
| `content` | string | 必須 | チケット本文 |
| `customerId` | int | 必須 | 顧客ID |
| `priority` | enum: Low \| Medium \| High | 必須 | 優先度 |
| `attachments` | string[] | 省略可 | 添付ファイルURL配列 |

#### ReplyManual ペイロード

| フィールド名 | 型 | 必須/省略可 | 説明 |
|---|---|---|---|
| `ticketId` | int | 必須 | チケットID |
| `operatorId` | int | 必須 | オペレータID |
| `message` | string | 必須 | 返信内容 |
| `resolution` | enum: Resolved \| Pending | 必須 | 解決状態 |

### 2b-3. 共有モジュール API シグネチャ

マルチエージェント通信で参照される API 関数を **正確な署名** で宣言（API-SIGNATURES.md）：

```typescript
// MessageValidator API
interface MessageValidator {
  validatePayload(msgType: string, payload: object): ValidationResult
  // パラメータ順序: msgType, payload
  // 戻り値: { isValid: bool, errors: string[] }
  
  checkDirection(sender: string, msgType: string): boolean
  // パラメータ順序: sender, msgType
}

// StateTransition API
interface StateTransition {
  isValidTransition(currentStatus: string, newStatus: string): boolean
  // パラメータ順序: currentStatus, newStatus
  
  getValidTransitions(currentStatus: string): string[]
  // パラメータ順序: currentStatus
  // 戻り値: 遷移可能な状態の配列
}
```

**重要**：パラメータの名前・順序・型は実装エージェントが直接参照するため、一度決めたら変更不可。

### 2b-4. 状態遷移マトリクス

プロトコルで管理される状態の遷移を Markdown 表で定義（VDM-SL ではなく）：

| 現在の状態 | → Created | → Assigned | → InProgress | → Resolved | → Closed |
|---|:---:|:---:|:---:|:---:|:---:|
| Created | ✗ | ✓ | ✗ | ✗ | ✓ |
| Assigned | ✗ | ✗ | ✓ | ✗ | ✓ |
| InProgress | ✗ | ✗ | ✗ | ✓ | ✓ |
| Resolved | ✗ | ✗ | ✗ | ✗ | ✓ |
| Closed | ✗ | ✗ | ✗ | ✗ | ✗ |

### 2b-5. Null フィールド注釈

各ペイロード型で、null を許容するフィールドを明示：

| メッセージ型 | Null 許容フィールド | デフォルト値 |
|---|---|---|
| TicketCreate | `attachments` | `[]` |
| ReplyManual | なし | — |
| AutoReply | `operatorName` | `null` |

### 2b-6. 命名規約宣言

プロトコル全体で使用する命名規約を統一宣言（一度だけ記述）：

```
【命名規約】
- メッセージ型：PascalCase（例：TicketCreate、AutoReply）
- ペイロード型：メッセージ型 + Payload suffix（例：TicketCreatePayload）
- フィールド名：camelCase（例：ticketId、operatorId）
- 状態値：PascalCase（例：Created、InProgress）
- API 関数名：動詞 + 名詞、camelCase（例：validatePayload、isValidTransition）
- 列挙値：PascalCase（例：Low、Medium、High、Resolved、Pending）
```

設計文書（PROTOCOL.md、API-SIGNATURES.md）に上記全てが含まれていることを確認。

## ステップ3：契約定義

**目的**：エージェントの前提条件と事後条件を形式化

各エージェント操作について、以下の契約を定義します。

ステートレスなエージェント（関数）の場合：

```vdm-sl
types

-- この例が使う型（ステップ4の完全なモジュールと同じ定義）
Score = nat1
inv s == s <= 100;

Threshold = nat1
inv t == t <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  complexity_score : Score;

functions

-- シグネチャ：引数の型は * で並べる（カリー化しない）
decide : Ticket * Threshold * Threshold -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
-- 前提条件（precondition）：pre の後に式だけを書く
pre t1 > t2
-- 事後条件（postcondition）：戻り値は RESULT で参照する
post (ticket.complexity_score > t1 => RESULT = <OperatorOnly>) and
     (t2 < ticket.complexity_score and ticket.complexity_score <= t1
        => RESULT = <OperatorAndLLM>) and
     (ticket.complexity_score <= t2 => RESULT = <AutoReply>);
```

ステートフルなエージェント（状態と操作）の場合：

```vdm-sl
types

TaskId = nat1;

Task ::
  id    : TaskId
  title : seq1 of char;

-- 状態：タスクの表と、次に発行するID
state TaskStore of
  tasks  : map TaskId to Task
  nextId : TaskId
inv mk_TaskStore(tasks, nextId) ==
  forall id in set dom tasks & tasks(id).id = id and id < nextId
init s == s = mk_TaskStore({|->}, 1)
end

operations

-- 操作のシグネチャは ==> で書く。操作前の値は tasks~ のように ~ を付けて参照する
DeleteTask : TaskId ==> ()
DeleteTask(id) ==
  tasks := {id} <-: tasks
pre id in set dom tasks
post tasks = {id} <-: tasks~ and nextId = nextId~;
```

**確認する観点**（依頼文から読み取る。読み取れず、仕様を左右するものだけ「進め方の原則」に従って確認する）：
- 各操作が受け付ける条件は何か（事前条件。例：存在しないIDは更新も削除もできない）
- 各操作が保証する結果は何か（事後条件。例：削除したタスクは一覧から消え、他のタスクは変わらない）
- 操作によって状態はどう変わるか（変わらない部分も含めて書く）
- 条件を満たさない呼び出しをどう扱うか（指定が無ければ、事前条件違反＝契約違反として扱い、状態は変えない）

**依頼文に書かれていないことが多く、決め忘れやすい項目**（該当するものは、質問するか、既定値で決めて完了報告の「決めたこと」に書く）：
- どの操作を用意するか（作成・取得・更新・削除・一覧 など。「更新」が何を変えるのか：タイトルか、ステータスか、両方か）。依頼文に出てくる操作と、それらを使うのに最低限必要な操作（例：更新と削除が出てくるなら、作成と一覧）にとどめ、依頼文に無い操作を黙って足さない。質問する場合の推奨もこの範囲にする
- 作成直後の初期値（例：ステータスは「未着手」から始まる）
- 一覧の並び順（例：ID昇順）
- 重複を許すか（例：同じタイトルのタスクを複数作れるか）
- IDの採番方法と、削除したIDを再利用するか（再利用しないなら、状態に「次に発行するID」のカウンタを持たせる。`最大のID + 1` 方式は、最新のレコードを削除した直後に同じIDを再発行する）
- 状態（ステータス）の変更に制限があるか（指定が無ければ制限なし。`references/contract-templates.md` パターン2の `validTransition` は制限がある場合の書き方で、制限が無ければ書かない）
- 長さ・個数の上限と下限、その数え方（文字列の長さは、VDMJ 4.7.0 でも生成される TypeScript でも UTF-16 のコード単位で数えられる。絵文字などは1文字が2と数えられる）

**契約記述のチェックポイント**：
- 前提条件は検証可能か？
- 事後条件は実装可能か？
- 前提条件なしで事後条件が成立することはないか？
- エッジケース（境界値）を網羅しているか？

## ステップ4：VDM-SL生成

**目的**：Phase 1（ドメイン論理）のVDM-SL仕様書を自動生成

**重要**：このステップでは、ステップ2で定義したデータ型と、ステップ3で定義した契約（前提条件・事後条件）のみを VDM-SL に変換します。ステップ2bで生成した設計文書（PROTOCOL.md、API-SIGNATURES.md）は VDM-SL に含めません。プロトコル仕様は別ドキュメントとして実装エージェントが直接参照します。

ここまでに整理した情報から、完全なVDM-SL仕様モジュールを生成します：

```vdm-sl
module HybridJudgeAgent

exports all

definitions

types

-- ======== 型定義 (Phase 1: ドメイン論理) ========

-- 不変式付き型：型定義の直後に inv を書く
Score = nat1
inv s == s <= 100;

Threshold = nat1
inv t == t <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  complexity_score : Score;

functions

-- ======== メイン関数 ========

decide : Ticket * Threshold * Threshold -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
pre t1 > t2
post (ticket.complexity_score > t1 => RESULT = <OperatorOnly>) and
     (t2 < ticket.complexity_score and ticket.complexity_score <= t1
        => RESULT = <OperatorAndLLM>) and
     (ticket.complexity_score <= t2 => RESULT = <AutoReply>);

end HybridJudgeAgent
```

ステートフルなエージェントの完全なモジュール例（`state` と `operations`、再利用しないID採番）は `references/contract-templates.md` のパターン2を参照。

**VDM-SL の書き方（必ず守る）**：このスキルと `references/contract-templates.md` の VDM-SL の例は、作成時に VDMJ 4.7.0 の構文チェック・型チェックを通したもの（断片はモジュールに組み込んだ形で確認。証明責務の証明まではしていない）。新しい仕様は、これらの例の形に従って書く。Javaが無い環境では書いた仕様を機械的に確かめられないので、書いた後に次の点を自分で読み直す（いずれも VDMJ がエラーにする書き方）：

- `definitions` の下に `types` / `values` / `functions` / `operations` の見出しを置いてから定義を書く（`state ... end` は見出し不要）。見出し無しで型や関数を書かない。
- 定義と定義の間は `;` で区切る。
- 型の不変式は、型定義の直後に `inv <変数> == <式>` と続けて書く。`Score = nat1` と書いた後で別の行に `Score inv s == ...` と書き足したり、`inv 名前(引数 : 型) == ...` という独立した定義を書いたりしない。
- 関数のシグネチャは `名前 : 型1 * 型2 -> 戻り値の型`。引数が複数あるときに `型1 -> 型2 -> 戻り値の型` と書かない（カリー化された別の関数になり、型エラーになる）。
- `pre` / `post` は本体の後に式だけを書く（`pre t1 > t2`）。`pre decide(ticket, t1, t2) == ...` のように関数名と引数を繰り返さない。`post` の中では戻り値を `RESULT` と書き、関数自身を呼び直さない。
- 比較を連鎖させない。`t2 < x <= t1` ではなく `t2 < x and x <= t1`。
- 予約語を引数名・変数名に使わない（`from`、`to`、`in`、`of`、`end`、`comp`、`state`、`types` など）。
- 存在しない型・演算子を使わない：0以上の整数は `nat`（`nat0` は無い）、含意は `=>`（`implies` は無い）、最大値を求める `max` は無い、本体を `???` と書かない。
- 状態を持つ場合：`state <名前> of <フィールド> inv mk_<名前>(...) == <式> init s == s = mk_<名前>(<初期値>) end` と書く。操作は `operations` の下に `名前 : 引数の型 ==> 戻り値の型`（戻り値が無ければ `()`、引数が無ければ `()`）。事後条件で操作前の値を指すときは `tasks~` のように `~` を付ける。複数の代入の途中で状態の不変式が一時的に破れる場合（例：表への追加とIDカウンタの更新）は、その代入を `atomic( ... )` でまとめる。

**事後条件で表を引くとき**：操作の事後条件の中で表（map）をキーで引くときは、操作前の表で引く（`RESULT = tasks~(id)`）か、操作後の表を決める等式（`tasks = tasks~` など）を `and` の左側に書いてから引く。`post RESULT = tasks(id) and tasks = tasks~` のように操作後の表を先に引く書き方は、構文チェック・型チェックは通るが、VDMJ の QuickCheck（`qc`）が「事後条件を評価できない場合がある」という反例を出す（VDMJ 4.7.0 で実測）。関数の事後条件から事前条件付きの関数を呼ぶ場合も同じで、その事前条件が成り立つ場合に限って呼ぶ（`post t1 > t2 => RESULT = decide(ticket, t1, t2)`）。

**本体を明示的に書く**：振る舞いが決まっている関数・操作には、`pre` / `post` だけでなく本体（`==` の右辺）も書く。本体の無い定義（`pre` / `post` だけの暗黙的定義や `is not yet specified`）は、`generate-code` で `TODO` スタブになり、その関数・操作に触れる契約テストは手で実装するまで失敗する。本体を書かずに残す場合は、その名前を完了報告に挙げる。

**ファイルへの保存（必須）**：

- 生成した仕様は、チャットに表示するだけで終わらせず、必ずファイルに保存する。後続の `generate-code` はワークスペースの `.vdmsl` ファイルを読み、その隣の `generated/` に実装を出力する。
- ファイル名は `<モジュール名>.vdmsl`（例：`TaskManager.vdmsl`）。モジュール名は PascalCase の英字にし、ファイル名と一致させる。
- 保存先はユーザーが指定した場所。指定が無ければカレントディレクトリ（保存先を尋ねるためだけの質問はしない）。
- 同名のファイルが既にある場合は、上書きする前にユーザーに確認する。
- 保存したファイルの絶対パスを完了報告（ステップ6）に書く。
- ステップ2bを実施した場合は、PROTOCOL.md と API-SIGNATURES.md も同じディレクトリに保存する。

**生成される出力物**：
- `<モジュール名>.vdmsl`：モジュール定義（全型、関数・操作、契約を含む）、エクスポート文（公開インターフェース）、必要な場合のみインポート文
- （ステップ2bを実施した場合のみ）PROTOCOL.md（メッセージ型、ペイロード構造、状態遷移）
- （ステップ2bを実施した場合のみ）API-SIGNATURES.md（共有モジュール API シグネチャ）
- 単独のエージェントの場合、出力物は `.vdmsl` ファイル1つだけ

## ステップ5：仕様レビュー

**目的**：生成された仕様の正確性を確認

以下の観点から、まず Claude 自身が保存した仕様を読み直します。これは目視の確認であり、型チェッカーは実行していません（機械的な構文・型チェックは `verify-spec`。Javaが必要）。「型エラーなし」「検証済み」とは報告しません。ステップ4の「VDM-SL の書き方」の各項目もここで確認します。

1. **型整合性**
   - 全ての参照型が定義されているか？
   - 型エラーはないか？
   - 集約型の構造は正しいか？

2. **不変式の妥当性**
   - 不変式は実装可能か？
   - 不変式は過度に厳しくないか？
   - 不変式は実装に必要か？

3. **契約の実現可能性**
   - 前提条件を満たす入力は存在するか？
   - 事後条件を満たす出力は存在するか？
   - 前提条件が満たされたとき、事後条件が必ず満たされるか？

4. **プロトコル完全性（ステップ2bを実施した場合のみ）**
   - PROTOCOL.md に全てのメッセージ型が定義されているか？
   - 各メッセージ型に対応するペイロード構造が定義されているか？
   - 状態遷移マトリクスは完全か？
   - API-SIGNATURES.md の関数シグネチャは実装エージェントが参照できるか？

5. **名前付け規約の一貫性**
   - 型名、関数名は規約に従っているか？
   - 同様の概念に異なる名前がついていないか？

**レビューの実施**：
ユーザーに VDM-SL を読んでもらうことを前提にしません。確認は、完了報告（ステップ6）の「操作ごとの約束」と「決めたこと」を平易な言葉で示し、「実際の要件と違うところがあれば教えてください」と添える形で1回にまとめます。ここで別途、質問を重ねません。

## ステップ6：完了報告と次のステップ

**目的**：何を保存し、何を決め、何が未検証かを伝え、次のプロンプトを案内する

### 6a. 完了報告（必須）

フェーズの最後に、次の項目をすべて含む報告を必ず出す。値は実際に保存したファイルと実際の仕様から埋める（`< >` は置き換え、プレースホルダを残さない）。

```text
契約定義：完了報告
- 保存したファイル: <絶対パス>/<モジュール名>.vdmsl
- エージェント: <名前>（<状態を持つ | 状態を持たない>）
- 操作ごとの約束:
  - <操作名>(<引数>): 受け付ける条件 = <事前条件を平易な言葉で> ／ 保証すること = <事後条件を平易な言葉で>
- 常に成り立つこと: <型と状態の不変式を平易な言葉で>
- 決めたこと（指示が無かったため既定値にした項目。違っていれば教えてください）: <項目の一覧 | なし>
- 作らなかったもの: <例: 単独のエージェントのため PROTOCOL.md / API-SIGNATURES.md は作成していない | なし>
- 本体が未定義の関数・操作（コード生成で TODO スタブになる）: <名前の一覧 | なし>
- 位置づけ: この仕様はLLMが会話から書き起こしたもので、構文チェック・型チェックを含め機械検証はしていない（ここまでの手順にJavaは不要で、使っていない）。
- 仕様の機械検証（VDMJ）は未実行。必要なら verify-spec スキルで実行できる（任意。Javaが必要）。
- 次のプロンプト: 「この仕様からTypeScriptコードを生成して」 → その次に「契約テストを生成して」
```

- **操作ごとの約束**：すべての関数・操作を1行ずつ。VDM-SL の式をそのまま貼らず、ユーザーの言葉で書く（例：「DeleteTask(id): 受け付ける条件 = そのIDのタスクが存在する ／ 保証すること = そのタスクだけが消え、他のタスクと次のIDは変わらない」）。
- **決めたこと**：質問せずに決めた項目と、ユーザーが「おまかせ」と答えた項目をすべて挙げる（用意した操作、初期値、並び順、重複の可否、IDの採番、状態の変更の制限、引用型の値の英語名、文字数の数え方 など）。
- **VDMJの行**：仕様を書いた直後なので、この行は常に「未実行」になる。以前の `verify-spec` の結果があっても、仕様を書き換えた後は古い結果として扱う。「検証済み」「型エラーなし」と書かない。
- **次のプロンプト**：コード生成が先。`generate-tests` は `generate-code` が出力した実装を import してテストするので、実装が無い段階で `generate-tests` を案内しない。TypeScript 以外を使うユーザーには「この仕様からPythonコードを生成して」のように言語を入れ替えて案内する。

### 6b. この後の流れの案内

完了報告に続けて、次の流れを示す。内容は実際の仕様の型名・操作名・条項から書く（このスキルの例に出てくる `Score` や `t1 > t2` などの名前を流用しない）。

```text
この後の流れ（それぞれ別のプロンプトで実行します）:
1. 「この仕様からTypeScriptコードを生成して」
   generate-code が <仕様ファイルのディレクトリ>/generated/ に、契約チェック付きの実装を出力する
2. 「契約テストを生成して」
   generate-tests が仕様から次のテストを生成し、実行コマンドを1つ示す
   - データの制約のテスト: <実際の型名と制約>
   - 受け付ける条件のテスト: <実際の操作名と事前条件>
   - 保証することのテスト: <実際の操作名と事後条件>
   - （ステップ2bを実施した場合のみ）メッセージ・状態遷移・APIシグネチャのテスト
3. （任意）「仕様を検証して」
   verify-spec が VDMJ で構文チェック・型チェック・証明責務の生成を行う（Javaが必要）
```

## テンプレート参照

このスキルで使用される標準テンプレート：

### パターン1: データ変換エージェント
**参照**: `references/contract-templates.md` の「パターン1」セクション
- 入力データを変換し、異なる形式の出力を返すエージェント
- VDM-SL例：テキスト正規化、データ形式変換

### パターン2: CRUD エージェント
**参照**: `references/contract-templates.md` の「パターン2」セクション
- データストア上の作成・読み取り・更新・削除を管理するエージェント
- VDM-SL例：`state` と `operations`、不変式による一貫性保証、再利用しないID採番、状態遷移

### パターン3: パイプラインエージェント
**参照**: `references/contract-templates.md` の「パターン3」セクション
- 複数の処理ステップを順序立てて実行するエージェント
- VDM-SL例：シーケンス処理、ステップ間の整合性

### パターン4: メディエータエージェント
**参照**: `references/contract-templates.md` の「パターン4」セクション
- 複数のエージェント間の通信を仲介するエージェント
- VDM-SL例：メッセージルーティング、例外処理

### パターン5: バリデーション エージェント
**参照**: `references/contract-templates.md` の「パターン5」セクション
- 入力データの妥当性を検証するエージェント
- VDM-SL例：複合制約検証、エラーレポート

### パターン6: Phase 2設計文書テンプレート
**参照**: `references/contract-templates.md` の「パターン6」セクション
- マルチエージェント間の通信仕様を設計文書として定義するテンプレート
- 設計文書例：メッセージ型レジストリ、ペイロード構造、状態遷移マトリクス、API シグネチャ

### パターン7: ハイブリッド判定エージェント
**参照**: `references/contract-templates.md` の「パターン7」セクション
- スコアベースの複合判定を行うエージェント
- VDM-SL例：スコア計算、しきい値比較、判定ロジック

## ワークフロー図

```
ステップ1: エージェントロール抽出
    ↓
ステップ2: データ型定義（Phase 1: ドメイン論理）
    ↓
ステップ2b: 設計文書生成（PROTOCOL.md, API-SIGNATURES.md）（Phase 2: プロトコル・API仕様）
            ※ 複数エージェント間の通信がある場合のみ。単独のエージェントではスキップ
    ↓
ステップ3: 契約定義（前提条件・事後条件）
    ↓
ステップ4: VDM-SL仕様生成（Phase 1）と .vdmsl ファイルへの保存
    ↓
ステップ5: 仕様（と設計文書）の読み直し ※ 目視。機械検証ではない
    ↓
ステップ6: 完了報告と次のステップの案内
    ↓
[完了。次は generate-code スキル（コード生成）→ generate-tests スキル（契約テスト生成）]
```

## 使用例

### 例1：シンプルなスコア計算エージェント

ユーザー入力：

- エージェント名：ScoreCalculator
- 責務：チケットの複雑度スコアを計算する
- 入力：Ticket型
- 出力：Score型（1-100）

生成される仕様（`ScoreCalculator.vdmsl` として保存）：

```vdm-sl
module ScoreCalculator

exports all

definitions

types

Score = nat1
inv s == s <= 100;

Ticket ::
  id      : nat1
  content : seq of char;

functions

-- 本文が長いほど複雑とみなし、1〜100 に収める
calculateScore : Ticket -> Score
calculateScore(ticket) ==
  if len ticket.content = 0 then 1
  elseif len ticket.content > 100 then 100
  else len ticket.content
post (len ticket.content > 100 => RESULT = 100) and
     (len ticket.content = 0 => RESULT = 1);

end ScoreCalculator
```

### 例2：マルチエージェント通信を含むハイブリッドシステム

```
ユーザー入力：
- エージェント1：HybridJudgeAgent（判定）
- エージェント2：MessageValidator（検証）
- 間の通信：メッセージベースのプロトコル

生成される設計文書（ステップ2b）：
【PROTOCOL.md】
## メッセージ型レジストリ
| メッセージ型 | 送信元 | 受信先 | 同期/非同期 |
|---|---|---|---|
| TicketCreate | User | Server | 同期 |
| TicketUpdate | User | Server | 同期 |
| AutoReply | Server | User | 非同期 |

## ペイロード構造 (TicketCreate)
| フィールド | 型 | 必須 |
|---|---|---|
| content | string | yes |
| priority | enum | yes |
| attachments | string[] | no |

## 状態遷移マトリクス
| 現在 | Created | Assigned | InProgress | Resolved | Closed |
|---|:---:|:---:|:---:|:---:|:---:|
| Created | ✗ | ✓ | ✗ | ✗ | ✓ |
| ...

【API-SIGNATURES.md】
interface MessageValidator {
  validatePayload(msgType: string, payload: object): ValidationResult
  checkDirection(sender: string, msgType: string): boolean
}

interface StateTransition {
  isValidTransition(currentStatus: string, newStatus: string): boolean
}

生成される VDM-SL 仕様（ステップ4、Phase 1）の概略：
（ここでは構成だけを示す。実際の仕様は、ステップ4の HybridJudgeAgent の例のように省略せずに書く）
module HybridSystem
  -- ステップ3で定義した契約（ドメイン論理）
  -- decide : Ticket * Threshold * Threshold -> Action と、その pre / post

  -- 注意：メッセージ型・状態遷移は VDM-SL に含めない
  -- それらは PROTOCOL.md で定義されている
end HybridSystem
```

## トラブルシューティング

### Q: verify-spec（VDMJ）で構文エラーや型チェックエラーが出た
**A**: このスキル自体は型チェッカーを実行しないため、エラーは `verify-spec` を実行して初めて分かります。まずステップ4の「VDM-SL の書き方」の各項目（セクション見出し、`;`、`inv` の位置、`pre` / `post` の書き方、連鎖比較、予約語）を確認してください。VDM-SL では定義の順序は問われないので、並べ替えや前方宣言は不要です。

### Q: 前提条件が厳しすぎて実装が困難
**A**: 前提条件の目的を再考してください。エージェントが入力を検証する責務を持つ場合、前提条件は「検証済み」という仮定として記述するべきです。一方、呼び出し元が責務を持つ場合は前提条件で強く制約してください。

### Q: プロトコル定義で方向判定関数が複雑になっている
**A**: メッセージ型を細分化することを検討してください。例えば `UserMsgType` をさらに `UserInMsgType` と `UserOutMsgType` に分割できます。

### Q: 事後条件が複数の関数に依存している
**A**: 事後条件は単一の関数の動作のみを記述するべきです。複数の関数の相互作用は、別途の統合テストで検証してください。

## 参考資料

- VDM-SL公式仕様：ISO/IEC 13817-1
- コード生成スキル（次のステップ）：`../generate-code/SKILL.md`
- テスト生成スキル（その次のステップ）：`../generate-tests/SKILL.md`
- 仕様検証スキル：`../verify-spec/SKILL.md`
