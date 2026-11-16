# エージェント契約テンプレート集

形式的エージェント契約の定義時に参照するVDM-SL標準パターン集です。

**このファイルの VDM-SL について**：パターン1〜5・7のモジュールと「実装時の注意点」の断片は、作成時に VDMJ 4.7.0 の構文チェック・型チェックを通し、いくつかの入力で実行して動作を確かめたものです（断片はモジュールに組み込んだ形で確認）。証明責務（PO）の証明まではしていません。新しい仕様を書くときは、ここにある書き方（`types` / `functions` / `operations` の見出し、`;` 区切り、`inv` の位置、`pre <式>` / `post <式>` と `RESULT`、`state ... end`、`x~`、`atomic`）に従ってください。Javaが無い環境では、書いた仕様を機械的に確かめる手段がありません。

---

## パターン1：データ変換エージェント

**用途**: 入力データを変換し、異なる形式の出力を返すエージェント

**特徴**:
- ステートレス（状態管理なし）。`functions` で書く
- 入出力型が異なる（出力型の制約は不変式で表す）
- 純粋な関数型

**VDM-SL テンプレート**:

```vdm-sl
module TextNormalizer

exports all

definitions

types

-- 入力型
InputText = seq of char;

-- 出力型：タブ・改行を含まない
NormalizedText = seq of char
inv t == forall c in set elems t & c not in set {'\t', '\n', '\r'};

functions

-- 正規化関数：タブ・改行を空白1文字に置き換える（長さは変えない）
normalize : InputText -> NormalizedText
normalize(text) ==
  [if text(i) in set {'\t', '\n', '\r'} then ' ' else text(i) | i in set inds text]
post len RESULT = len text and
     forall i in set inds text &
       text(i) not in set {'\t', '\n', '\r'} => RESULT(i) = text(i);

end TextNormalizer
```

---

## パターン2：CRUD エージェント

**用途**: データストア上の作成・読み取り・更新・削除を管理するエージェント

**特徴**:
- ステートフル（データベース状態を管理）。VDM-SL の `state` と `operations` で書く。`generate-code` は `state` をクラスに、操作をそのメソッドに変換する
- 不変式によるデータ一貫性保証（表のキーとレコードのIDが一致し、発行済みのIDはすべて `nextId` より小さい）
- IDは `nextId` カウンタから発行し、カウンタは増やすだけ。削除したIDは再利用されない（`最大のID + 1` 方式だと、最新のレコードを削除した直後に同じIDが再発行される。IDを再利用したい要件のときだけ、その方式に変える）
- 事後条件では、変わる部分だけでなく変わらない部分（他のレコード、`nextId`）も `x~` を使って書く
- 状態遷移の明確化

**VDM-SL テンプレート**:

```vdm-sl
module TicketManager

exports all

definitions

types

TicketId = nat1;

TicketStatus = <Created> | <Assigned> | <InProgress> | <Resolved> | <Closed>;

-- タイトルは1文字以上255文字以下
Title = seq1 of char
inv t == len t <= 255;

Ticket ::
  id     : TicketId
  title  : Title
  status : TicketStatus;

-- 状態：チケットの表と、次に発行するID
state TicketStore of
  tickets : map TicketId to Ticket
  nextId  : TicketId
inv mk_TicketStore(tickets, nextId) ==
  forall id in set dom tickets &
    tickets(id).id = id and id < nextId
init s == s = mk_TicketStore({|->}, 1)
end

functions

-- 状態遷移の規則（from / to は予約語なので引数名に使えない）
validTransition : TicketStatus * TicketStatus -> bool
validTransition(current, next) ==
  cases current:
    <Created>    -> next in set {<Assigned>, <Closed>},
    <Assigned>   -> next in set {<InProgress>, <Closed>},
    <InProgress> -> next in set {<Resolved>, <Closed>},
    <Resolved>   -> next = <Closed>,
    <Closed>     -> false   -- 終了状態：どこへも遷移できない
  end;

operations

-- CREATE：IDは nextId から発行し、nextId は増やすだけ（削除したIDを再利用しない）
CreateTicket : Title ==> TicketId
CreateTicket(title) ==
  let id = nextId in (
    -- 2つの代入の途中で状態不変式（id < nextId）が破れないよう atomic でまとめる
    atomic(
      tickets := tickets munion {id |-> mk_Ticket(id, title, <Created>)};
      nextId := nextId + 1
    );
    return id
  )
post RESULT = nextId~ and
     nextId = nextId~ + 1 and
     tickets = tickets~ munion {RESULT |-> mk_Ticket(RESULT, title, <Created>)};

-- READ
GetTicket : TicketId ==> Ticket
GetTicket(id) ==
  return tickets(id)
pre id in set dom tickets
post tickets = tickets~ and nextId = nextId~ and RESULT = tickets~(id);

-- UPDATE
UpdateStatus : TicketId * TicketStatus ==> ()
UpdateStatus(id, newStatus) ==
  tickets := tickets ++ {id |-> mu(tickets(id), status |-> newStatus)}
pre id in set dom tickets and
    validTransition(tickets(id).status, newStatus)
post tickets = tickets~ ++ {id |-> mu(tickets~(id), status |-> newStatus)} and
     nextId = nextId~;

-- DELETE
DeleteTicket : TicketId ==> ()
DeleteTicket(id) ==
  tickets := {id} <-: tickets
pre id in set dom tickets
post tickets = {id} <-: tickets~ and nextId = nextId~;

-- LIST：ID昇順
ListTickets : () ==> seq of Ticket
ListTickets() ==
  return [tickets(id) | id in set dom tickets]
post elems RESULT = rng tickets and
     len RESULT = card dom tickets and
     (forall i in set inds RESULT & i > 1 => RESULT(i - 1).id < RESULT(i).id) and
     tickets = tickets~ and nextId = nextId~;

end TicketManager
```

---

## パターン3：パイプラインエージェント

**用途**: 複数の処理ステップを順序立てて実行するエージェント

**特徴**:
- 各ステップの出力が次のステップの入力
- ステップ間の型整合性保証
- 部分的成功/失敗の処理

**VDM-SL テンプレート**:

```vdm-sl
module TextProcessingPipeline

exports all

definitions

types

RawText = seq of char;

-- クリーニング済みテキスト：改行・タブを含まない
CleanedText = seq of char
inv t == forall c in set elems t & c not in set {'\n', '\t'};

Token = seq1 of char;
TokenizedText = seq of Token;

-- 処理結果：成功ならトークン列、失敗なら理由
Success :: tokens : TokenizedText;
Failure :: reason : seq1 of char;
ProcessingResult = Success | Failure;

functions

-- ステップ1：クリーニング（改行とタブを取り除く）
cleanText : RawText -> CleanedText
cleanText(text) ==
  [text(i) | i in set inds text & text(i) not in set {'\n', '\t'}]
post len RESULT <= len text;

-- ステップ2：トークン化（空白区切り。空のトークンは作らない）
tokenizeText : CleanedText -> TokenizedText
tokenizeText(text) ==
  if text = [] then []
  elseif hd text = ' ' then tokenizeText(tl text)
  else let n = wordLength(text) in
         [text(1, ..., n)] ^ tokenizeText(text(n + 1, ..., len text))
post forall i in set inds RESULT & ' ' not in set elems RESULT(i)
measure len text;

-- 先頭の単語の長さ
wordLength : CleanedText -> nat
wordLength(text) ==
  if text = [] or hd text = ' ' then 0
  else 1 + wordLength(tl text)
post RESULT <= len text
measure len text;

-- パイプライン実行：ステップ1の出力がステップ2の入力になる
processPipeline : RawText -> ProcessingResult
processPipeline(text) ==
  if text = [] then mk_Failure("Empty input")
  else mk_Success(tokenizeText(cleanText(text)))
post (text = [] <=> is_Failure(RESULT)) and
     (text <> [] <=> is_Success(RESULT));

end TextProcessingPipeline
```

---

## パターン4：メディエータエージェント

**用途**: 複数のエージェント間の通信を仲介するエージェント

**特徴**:
- メッセージのルーティング
- エージェント間の疎結合化
- 例外処理と再試行

**VDM-SL テンプレート**:

```vdm-sl
module MessageMediator

exports all

definitions

types

MessageType = <TicketCreate> | <TicketUpdate> | <Escalation> | <Reply>;
SenderType = <User> | <Agent> | <Operator>;
Destination = <ToAgent> | <ToOperator> | <ToUser>;

Message ::
  msg_type : MessageType
  sender   : SenderType
  content  : seq1 of char
  priority : nat1;

-- ルーティング結果：届け先が決まった、または送信元が不正なので拒否した
Routed :: destination : Destination;
RouteResult = Routed | <Rejected>;

functions

-- そのメッセージ型を送ってよい送信元か
allowedSender : MessageType * SenderType -> bool
allowedSender(msgType, sender) ==
  cases msgType:
    <TicketCreate> -> sender = <User>,
    <TicketUpdate> -> sender = <User>,
    <Escalation>   -> sender in set {<User>, <Agent>},
    <Reply>        -> sender in set {<Agent>, <Operator>}
  end;

-- メッセージ型ごとの届け先
destinationOf : MessageType -> Destination
destinationOf(msgType) ==
  cases msgType:
    <TicketCreate> -> <ToAgent>,
    <TicketUpdate> -> <ToAgent>,
    <Escalation>   -> <ToOperator>,
    <Reply>        -> <ToUser>
  end;

-- メッセージルーティング
routeMessage : Message -> RouteResult
routeMessage(msg) ==
  if allowedSender(msg.msg_type, msg.sender)
  then mk_Routed(destinationOf(msg.msg_type))
  else <Rejected>
post (allowedSender(msg.msg_type, msg.sender) <=> is_Routed(RESULT)) and
     (is_Routed(RESULT) => RESULT.destination = destinationOf(msg.msg_type));

end MessageMediator
```

---

## パターン5：バリデーション エージェント

**用途**: 入力データの妥当性を検証するエージェント

**特徴**:
- 複合制約の検証
- エラーレポート
- 段階的検証

**VDM-SL テンプレート**:

```vdm-sl
module InputValidator

exports all

definitions

types

-- 入力型（検証前の値なので、フィールドに不変式はかけない）
Ticket ::
  id          : nat1
  title       : seq of char
  priority    : nat
  complexity  : nat
  customer_id : nat1;

ErrorMessage = seq1 of char;

-- 検証結果：問題なし、またはエラーの一覧（1件以上）
Invalid :: errors : seq1 of ErrorMessage;
ValidationResult = <Valid> | Invalid;

functions

-- 段階的検証関数
validTitle : seq of char -> bool
validTitle(title) ==
  len title > 0 and len title <= 255;

validPriority : nat -> bool
validPriority(priority) ==
  priority <= 10;

validComplexity : nat -> bool
validComplexity(complexity) ==
  complexity <= 100;

-- エラー収集（違反した項目ごとに1件）
collectErrors : Ticket -> seq of ErrorMessage
collectErrors(ticket) ==
  (if validTitle(ticket.title) then []
   else ["Title must be between 1 and 255 characters"]) ^
  (if validPriority(ticket.priority) then []
   else ["Priority must be between 0 and 10"]) ^
  (if validComplexity(ticket.complexity) then []
   else ["Complexity must be between 0 and 100"]);

-- メイン検証関数
validateTicket : Ticket -> ValidationResult
validateTicket(ticket) ==
  let errors = collectErrors(ticket) in
    if errors = [] then <Valid> else mk_Invalid(errors)
post (RESULT = <Valid> <=>
        validTitle(ticket.title) and
        validPriority(ticket.priority) and
        validComplexity(ticket.complexity)) and
     (is_Invalid(RESULT) => RESULT.errors = collectErrors(ticket));

end InputValidator
```

---

## パターン6：Phase 2設計文書テンプレート

**用途**: VDM-SL仕様と実装の間に、詳細設計ドキュメント（PROTOCOL.md、API-SIGNATURES.md）を生成するテンプレート

**特徴**:
- メッセージ型の正規名簿（Single Source of Truth）
- ペイロード構造の明示的仕様
- 状態遷移規則の設計書化
- API関数シグネチャの統一定義
- 命名規約の宣言

**設計文書テンプレート（マークダウン形式）**:

### PROTOCOL.md テンプレート

```markdown
# PROTOCOL.md — 通信プロトコル仕様

## メッセージ型レジストリ

**方針**: 各方向のメッセージ型を一元管理し、Single Source of Truth とする。
コンポーネント間のメッセージやりとりでは必ずこのリストを参照すること。

### クライアント → サーバー

| メッセージ型 | 説明 | 前提条件 | 状態遷移 |
|-----------|------|--------|--------|
| `ticket_create` | チケット作成リクエスト | WebSocket接続済み、`customer_id` > 0 | チケット：created |
| `ticket_update` | チケット更新リクエスト | チケットが存在、遷移可能な状態 | チケット状態遷移 |
| `escalation_request` | エスカレーションリクエスト | チケットが作成済み、未解決 | チケット：escalated |

### サーバー → クライアント

| メッセージ型 | 説明 | トリガー | 前提条件 |
|-----------|------|--------|--------|
| `ticket_created` | チケット作成完了 | ticket_create受信後 | ticket_id生成成功 |
| `auto_reply` | 自動返信 | ticket_create受信後、スコア ≤ t2 | スコア計算成功 |
| `operator_reply` | オペレータ返信 | operator_send_message受信後 | オペレータ認可 |
| `ticket_updated` | チケット更新完了 | ticket_update受信後 | ステータス遷移成功 |

### オペレータ → サーバー

| メッセージ型 | 説明 | 前提条件 |
|-----------|------|--------|
| `reply_manual` | 手動返信送信 | チケット割り当て済み |
| `mark_complete` | 完了マーク | チケット進行中 |
| `escalate_operator` | 上位エスカレーション | チケット割り当て済み |

### サーバー → オペレータ

| メッセージ型 | 説明 | トリガー |
|-----------|------|--------|
| `assign_ticket` | チケット割り当て | ticket_create受信かつスコア > t1 |
| `request_reply` | 返信要求 | t2 < スコア ≤ t1（ハイブリッド処理） |
| `update_status` | ステータス更新 | ticket_update受信後 |

---

## ペイロード構造

### ticket_create

発信元: クライアント  
受信先: サーバー

| フィールド | 型 | 必須 | 制約 | 説明 |
|-----------|----|----|------|------|
| `customer_id` | `number` | Yes | > 0 | 顧客ID |
| `title` | `string` | Yes | 1 ≤ len ≤ 255 | チケットタイトル |
| `description` | `string` | No | len ≤ 2000 | 詳細説明 |

### ticket_update

発信元: クライアント  
受信先: サーバー

| フィールド | 型 | 必須 | 制約 | 説明 |
|-----------|----|----|------|------|
| `ticket_id` | `number` | Yes | > 0 | 既存チケットID |
| `new_status` | `string` | Yes | in {created, assigned, in_progress, resolved, closed} | 遷移先ステータス |

### escalation_request

発信元: クライアント  
受信先: サーバー

| フィールド | 型 | 必須 | 制約 | 説明 |
|-----------|----|----|------|------|
| `ticket_id` | `number` | Yes | > 0 | チケットID |
| `reason` | `string` | No | len ≤ 500 | エスカレーション理由 |

### ticket_created

発信元: サーバー  
受信先: クライアント

| フィールド | 型 | 必須 | 制約 | 説明 |
|-----------|----|----|------|------|
| `ticket_id` | `number` | Yes | > 0 | 新規チケットID |
| `status` | `string` | Yes | = "created" | ステータス（初期値固定） |
| `created_at` | `number` | Yes | > 0 | タイムスタンプ（ミリ秒） |

### auto_reply

発信元: サーバー  
受信先: クライアント

| フィールド | 型 | 必須 | 制約 | 説明 |
|-----------|----|----|------|------|
| `ticket_id` | `number` | Yes | > 0 | 対象チケットID |
| `reply_text` | `string` | Yes | len > 0 | 自動返信文 |
| `score` | `number` | Yes | 1 ≤ score ≤ t2 | 複雑度スコア |

---

## 状態遷移マシン

### TicketStatus

| 現在状態 | 遷移可能な状態 | トリガーメッセージ |
|--------|-----------|------------------|
| `created` | `assigned`, `closed` | `ticket_update`（status=assigned\|closed） |
| `assigned` | `in_progress`, `closed` | `ticket_update`（status=in_progress\|closed） |
| `in_progress` | `resolved`, `closed` | `ticket_update`（status=resolved\|closed） |
| `resolved` | `closed` | `ticket_update`（status=closed） |
| `closed` | ※なし（終了状態） | — |

---

## 命名規約

### メッセージ型名
- **形式**: snake_case、英語小文字
- **例**: `ticket_create`, `auto_reply`, `escalation_request`
- **反例**: `TicketCreate`（PascalCase）、`ticket_creates`（複数形）

### フィールド名
- **形式**: snake_case、英語小文字
- **例**: `customer_id`, `reply_text`, `created_at`
- **反例**: `customerId`（camelCase）、`customer_ID`（大文字混在）

### ステータス値
- **形式**: snake_case、英語小文字
- **例**: `created`, `in_progress`, `resolved`
- **反例**: `Created`（大文字）、`inProgress`（camelCase）

### 関数シグネチャ（APIエンドポイント）
- **形式**: camelCase、英語
- **例**: `createTicket()`, `updateTicketStatus()`, `escalateTicket()`

---

## WebSocket接続前提条件

1. **接続確立**: クライアントはメッセージ送信前に必ずWebSocket接続を確立すること
2. **ハンドシェイク**: サーバーは接続確立時に `connection_ack` を返す
3. **タイムアウト**: 30秒以内に送信がない場合は接続を切断

---

## Null安全性

- **ペイロードフィールド**: Required列が「Yes」のフィールドは null/undefined であってはならない
- **メッセージ型**: 不正なメッセージ型を受け取った場合、サーバーは `error_invalid_message_type` を返して接続を切断
- **ペイロード検証**: 各フィールドの制約違反は検証エラーとして報告（メッセージ破棄）

---

## エラーハンドリング

| エラー種別 | 対応メッセージ型 | 復旧方法 |
|-----------|--------------|--------|
| 不正なメッセージ型 | `error_invalid_message_type` | 接続を切断し再接続 |
| ペイロード検証失敗 | `error_validation_failed` | ペイロードを確認して再送 |
| 状態遷移不可 | `error_invalid_transition` | 現在の状態を確認 |
| 認可不足 | `error_unauthorized` | 認可情報を確認 |
```

### API-SIGNATURES.md テンプレート

````markdown
# API-SIGNATURES.md — 関数シグネチャ定義

## クライアント側API

### createTicket

```typescript
function createTicket(
  customerId: number,
  title: string,
  description?: string
): Promise<{ ticketId: number; status: string; createdAt: number }>
```

**前提条件**:
- `customerId` > 0
- 1 ≤ `title.length` ≤ 255
- WebSocket接続確立済み

**例外**:
- `ValidationError`: ペイロード検証失敗
- `TimeoutError`: サーバー応答なし（30秒）
- `ConnectionError`: WebSocket未接続

---

### updateTicketStatus

```typescript
function updateTicketStatus(
  ticketId: number,
  newStatus: 'created' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
): Promise<{ ticketId: number; status: string; updatedAt: number }>
```

**前提条件**:
- チケットが存在する
- `newStatus` が現在状態から遷移可能

---

## サーバー側API

### broadcastToClient

```typescript
function broadcastToClient(
  clientId: string,
  messageType: string,
  payload: unknown
): Promise<void>
```

**前提条件**:
- クライアントがWebSocket接続済み
- `messageType` が レジストリに存在
- `payload` が対応スキーマを満たす

---

## スコアリングAPI（ハイブリッド判定）

### calculateComplexityScore

```typescript
function calculateComplexityScore(
  ticketTitle: string,
  ticketDescription: string
): Promise<number>
```

**戻り値**: 1 ≤ score ≤ 100

---

### decideAction

```typescript
function decideAction(
  score: number,
  thresholdT1: number,
  thresholdT2: number
): 'auto_reply' | 'operator_and_llm' | 'operator_only'
```

**前提条件**:
- `t1 > t2`
- 1 ≤ `score`, `t1`, `t2` ≤ 100

**戻り値の意味**:
- `auto_reply`: `score ≤ t2` → 自動返信で対応
- `operator_and_llm`: `t2 < score ≤ t1` → LLM + オペレータのハイブリッド処理
- `operator_only`: `score > t1` → オペレータのみで対応
````

**実装時の注意点**：
- PROTOCOL.md はVDM-SL仕様と一貫性を保つ。矛盾がある場合は VDM-SL を優先
- API-SIGNATURES.md は TypeScript 型定義と同期させる
- メッセージ型、ペイロードフィールド、状態遷移はこのドキュメントを Single Source of Truth とする
- 実装コード内の定義とドキュメントのズレを防ぐため、契約テストで照合する

---

## パターン7：ハイブリッド判定エージェント

**用途**: スコアベースの複合判定を行うエージェント

**特徴**:
- スコア計算と複数のしきい値による判定
- 明確な判定ロジック
- エッジケース処理

**VDM-SL テンプレート**:

```vdm-sl
module HybridJudgeAgent

exports all

definitions

types

-- ======== 型定義 ========

-- 1〜100 のスコア
Score = nat1
inv s == s <= 100;

-- 1〜100 のしきい値
Threshold = nat1
inv t == t <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

Ticket ::
  id               : nat1
  title            : seq1 of char
  content          : seq of char
  priority         : nat
  complexity_score : Score;

functions

-- ======== スコア集約関数（降順に並べ替える） ========

scoreAll : seq of Score -> seq of Score
scoreAll(scores) ==
  if scores = [] then []
  else insertDescending(hd scores, scoreAll(tl scores))
post len RESULT = len scores and
     elems RESULT = elems scores and
     forall i, j in set inds RESULT & i < j => RESULT(i) >= RESULT(j)
measure len scores;

-- 降順に並んだ列の正しい位置に1件挿入する
insertDescending : Score * seq of Score -> seq of Score
insertDescending(s, sorted) ==
  if sorted = [] then [s]
  elseif s >= hd sorted then [s] ^ sorted
  else [hd sorted] ^ insertDescending(s, tl sorted)
post len RESULT = len sorted + 1
measure len sorted;

-- ======== メイン判定関数 ========

decide : Ticket * Threshold * Threshold -> Action
decide(ticket, t1, t2) ==
  if ticket.complexity_score > t1 then <OperatorOnly>
  elseif ticket.complexity_score > t2 then <OperatorAndLLM>
  else <AutoReply>
-- 前提条件：しきい値の順序（値域 1〜100 は Score / Threshold の不変式が保証する）
pre t1 > t2
-- 事後条件：3つの範囲と判定結果の対応
post (ticket.complexity_score > t1 => RESULT = <OperatorOnly>) and
     (t2 < ticket.complexity_score and ticket.complexity_score <= t1
        => RESULT = <OperatorAndLLM>) and
     (ticket.complexity_score <= t2 => RESULT = <AutoReply>);

-- ======== 詳細判定関数（判定と説明文の組を返す） ========

decideWithExplanation : Ticket * Threshold * Threshold -> Action * seq1 of char
decideWithExplanation(ticket, t1, t2) ==
  let action = decide(ticket, t1, t2) in
    mk_(action, explainDecision(action))
pre t1 > t2
post t1 > t2 =>
       (RESULT.#1 = decide(ticket, t1, t2) and
        RESULT.#2 = explainDecision(RESULT.#1));

-- ======== 副関数 ========

explainDecision : Action -> seq1 of char
explainDecision(action) ==
  cases action:
    <OperatorOnly>   -> "Complexity exceeds maximum threshold",
    <OperatorAndLLM> -> "Complexity in hybrid processing range",
    <AutoReply>      -> "Complexity within auto-reply threshold"
  end;

end HybridJudgeAgent
```

**実装時の注意点**：
- `t1 > t2`の前提条件により、スコアの大小比較が一意に決定（値域 1〜100 は `Score` / `Threshold` の不変式が保証するので、前提条件に重ねて書かない）
- スカラパラメータ（`t1`, `t2`）は構造体ではなく分離して定義
- 事後条件は3値全ての判定結果をカバー
- エッジケース（`score == t1`、`score == t2`）を明確に扱う

---

## 実装時の注意点（全パターン共通）

### 命名規約の厳格化

| 要素 | 規約 | 例 |
|------|------|-----|
| 型名 | PascalCase（英語） | `TicketStatus`, `Score`, `WsMessage` |
| 関数名 | camelCase（英語） | `decideAction`, `validateInput`, `routeMessage` |
| Quote型値 | `<PascalCase>`（英語） | `<Created>`, `<OperatorOnly>`, `<AutoReply>` |
| 判定関数 | `is` + 名詞 または `valid` + 名詞 | `isValid`, `isClientToServer`, `validTransition` |
| 抽出関数 | `get` + 名詞 | `getPayload`, `getStatus` |
| 検証関数 | `validate` + 名詞 | `validateTicket`, `validateMessage` |
| 状態チェック関数 | `canTransitionTo` | `canTransitionTo(current, next)`（`from` / `to` は予約語なので引数名に使えない） |

### 不変式の形式化

不変式は型定義の直後に `inv <変数> == <式>` と書く（独立した `inv 名前(引数) == ...` という定義は書けない）。

```vdm-sl
types

-- 良い例：値域を不変式で明示する（1〜100）
Score = nat1
inv s == s <= 100;

-- 悪い例：nat1 なら常に成り立つ条件で、上限が表現されていない
LooseScore = nat1
inv s == s > 0;
```

### 前提条件と事後条件

`pre` / `post` は関数本体の後に式だけを書く。関数名と引数を繰り返さず、戻り値は `RESULT` で参照する。

```vdm-sl
types

Score = nat1
inv s == s <= 100;

Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

functions

decide : Score * Score * Score -> Action
decide(score, t1, t2) ==
  if score > t1 then <OperatorOnly>
  elseif score > t2 then <OperatorAndLLM>
  else <AutoReply>
-- 前提条件：呼び出し側の責任を明記
pre t1 > t2
-- 事後条件：実装側の責任を明記
post score > t1 => RESULT = <OperatorOnly>;
```

---

## 実装への変換について

VDM-SL の型・不変式・事前条件・事後条件をコードにどう変換するか（実行時チェックの置き方、契約違反のエラーの型、数値の扱い）は、`generate-code` スキルの `references/typescript-rules.md` と `references/python-rules.md` が定めています。このファイルには実装例を置きません。
