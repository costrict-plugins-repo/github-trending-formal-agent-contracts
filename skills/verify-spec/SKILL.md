---
name: verify-spec
description: >
  VDM-SL仕様ファイルの検証（構文チェック・型チェック・証明責務生成）と、
  設計文書（PROTOCOL.md、API-SIGNATURES.md）のチェックリストに基づくレビューを行う。
  「仕様を検証して」「VDMファイルをチェックして」「型チェックして」
  「PO（証明責務）を生成して」「仕様に問題がないか確認して」
  「エラーがないかチェックして」「.vdmslファイルを検証」といったリクエストに使用する。
  English triggers: "verify the spec", "type-check the VDM file",
  "generate proof obligations", "check the specification for errors".
  VDMJを使って検証を実行し、結果を形式手法の知識がない開発者にも
  わかるように自然言語で解説する。
metadata:
  version: "2.0.0"
  author: Formal Agent Contracts
  tags: [vdm-sl, verification, type-checking, formal-specification]
---

# 仕様検証スキル

VDM-SL仕様ファイルの構文チェック、型チェック、証明責務（PO: Proof Obligation）生成を実行し、開発者にわかりやすく結果を報告するスキルです。設計文書のレビューも行いますが、VDMJの機械検査とは区別して報告します。

## 概要

VDM-SLで記述された形式仕様は、以下の複数のレベルで検証が必要です：

1. **構文検証**：VDM-SL文法に従っているか
2. **型チェック**：型参照、型不整合がないか
3. **証明責務生成**：形式証明が必要な条件を生成（型チェックの直後に実行する。ステップ3b）
4. **不変式レビュー**：型検査の結果、具体例、未証明の充足性を区別する
5. **契約レビュー**：前提条件・事後条件と未証明の責務を整理する
6. **設計文書レビュー**：PROTOCOL.md、API-SIGNATURES.mdがある場合に、記載漏れ・不整合の候補を確認する（define-contract は、エージェント間の通信が無い仕様ではこの2つを作らない）

実行の順序は「構文・型チェック（ステップ2・3）→ PO生成（3b）→ レビュー（ステップ4〜6。生成済みのPOを参照する）→ 報告（ステップ7）→ 次のステップの提案（ステップ8）」です。

VDMJで実行するのは構文・型検査とPO生成です。PO生成はPOの証明ではありません。不変式の充足性、契約の実現可能性、設計文書の完全性を、このコマンドだけで保証することはできません。

検査を始める前に [検査結果の記録規則](references/verification-results.md) を読み、実行ログ、入力のハッシュ、確認範囲、未実行事項を残してください（ログの保存先とハッシュの取り方は末尾の「VDMJコマンド参照」）。各ステップの「記入例」「出力例」は説明用であり、実際に実行していない成功結果やPOを出力するための雛形ではありません。最終報告は、ステップ7の報告形式1つにまとめます。

## ステップ1：検証ファイルの指定

**目的**：検証対象のVDM-SLファイルを特定

次の情報は、まず依頼文・会話・ワークスペースから読み取ります。読み取れないものだけユーザーに確認します：

- **ファイルパス**：検証するVDM-SLファイル（`.vdmsl`形式）。指定が無ければ、カレントディレクトリの `.vdmsl` を探す（define-contract は、保存先の指定が無ければ、仕様を `<モジュール名>.vdmsl` としてカレントディレクトリに保存する）。1つだけならそれを対象にし、質問しない。複数ある場合と、1つも無い場合だけ尋ねる
- **モジュール名**：ファイルの `module <名前>` から読む（例：`HybridJudgeAgent`）。質問しない
- **検証範囲**：全モジュール / 特定の関数のみ。指定が無ければ全モジュール
- **既存の検証結果**：仕様ファイルの隣（`verification.json`、`evidence/` など）や会話にあれば読む。無ければ「なし」として進める

**質問例**（`.vdmsl` が複数ある、または見つからない場合のみ）：
```
検証するVDM-SLファイルを教えてください：
形式：ファイルパスまたはファイル名
例：/path/to/agents/HybridJudgeAgent.vdmsl
```

### 1b. VDMJ の起動方法を確かめる（検査を実行する前に）

このスキルは Java や VDMJ をインストールしません。次の順で、実際にコマンドを実行して確かめます（推測しない）：

1. `java -version` が版を表示するか。macOS では `java` コマンドがあっても Java 本体が入っていないことがあり、その場合はエラーになる。**エラーになっても、ここで止めずに 2〜4 を続ける**（起動スクリプトが自分で Java の場所を設定している環境では、`java -version` が失敗しても `vdmj.sh -v` は成功する。実測）
2. `command -v vdmj.sh` が起動スクリプトのパスを表示するか。表示されれば、以降のコマンドの `vdmj.sh` をそのまま使える
3. 表示されない場合は、`vdmj.sh` の場所をユーザーに1回だけ尋ねる（質問例：「`vdmj.sh` が PATH に見つかりませんでした。VDMJ の配布版 ZIP を展開したディレクトリを教えてください。まだ入れていない場合は、そう答えてください」）。ユーザーが答えるのはディレクトリなので、その末尾に `/vdmj.sh` を付けた絶対パスで、以降のコマンドの `vdmj.sh` を置き換える（VDMJ 4.7.0 の配布版の `vdmj.sh` は絶対パスで起動できる。実測）。ただし、そのパスに空白が含まれていると、4.7.0 の `vdmj.sh` は起動に失敗する（`ClassNotFoundException`。実測）。その場合は `java -jar "<展開したディレクトリ>/vdmj-<版>.jar"`（パスを引用符で囲む。構文・型チェックと PO 生成は動くが、QuickCheck は使えない。実測）に置き換えるか、空白の無い場所へディレクトリを移してもらう。Maven の単体 jar しか無い場合も `java -jar <vdmj.jar のパス>` に置き換える
4. `vdmj.sh -v`（3 で置き換えた場合は、そのコマンドに `-v`）を実行する。版が表示されれば起動できている。その出力（VDMJ の版）を、ステップ7の報告の「ツール」に書く

4 で版が表示されなかった場合（Java が無い、VDMJ の場所が分からない、など）は、構文検査・型検査・PO生成を実行できません。そのときは次のようにします：

- ステップ7の報告形式で各項目を「未実行」と報告し、理由（実行したコマンドと、表示されたエラー）を書く
- `references/vdmj-setup.md` を読み、ユーザーの OS に合う手順（Java の導入 → VDMJ の導入 → 確認）を回答の中で伝える。このファイルはプラグインの中にあり、ユーザーはその場所を知らないので、ファイル名を示すだけで済ませない
- 仕様を読んだだけの結果を、VDMJ の検査結果として報告しません。ステップ4〜6（読み取りによるレビュー）は、既定では行わずにここで終える。ユーザーが VDMJ 無しでのレビューを求めた場合だけ行い、「VDMJ は未実行。仕様を読んだだけのレビュー」と明記する

## ステップ2：構文検証

**目的**：VDM-SL文法に従っているか確認

次のコマンドを実行します（`spec.vdmsl` は対象のファイルに置き換える）。このコマンド1つで、構文チェックと型チェック（ステップ3）の両方が行われます。出力はログに保存します（保存先は「VDMJコマンド参照」）。

```bash
vdmj.sh -vdmsl spec.vdmsl
```

構文チェックで検査されるのは、次のような点です：

- キーワード（`module`, `exports`, `definitions`等）の正確性
- 型定義の文法（`Record ::`, `= ... |`等）
- 関数定義の文法（`pre/post`キーワード）
- クォーテーション（`<`,`>`の対応）
- コメント（`--`）の形式

**出力例**（VDMJ 4.7.0 で実測。`Parsed` の行が構文チェック、`Type checked` の行が型チェックの結果。終了コードは0）：
```text
Parsed 1 module in 0.019 secs. No syntax errors
Type checked 1 module in 0.045 secs. No type errors
Completed 1 module in 0.024 secs. No completion errors
Bye
```

エラーも警告も無い場合に VDMJ が出力するのは、これだけです。エンコーディング・行数・型や関数の個数は VDMJ の出力に無いので、VDMJ の結果として報告に書きません。

**エラー例**（5行目の `definitions` を `defs` と書いた場合。VDMJ 4.7.0 で実測。終了コードは1）：
```text
Error 2171: Expecting 'end' after module definitions in 'HybridJudgeAgent' (HybridJudgeAgent.vdmsl) at line 5:1
Bye
```

報告では、VDMJ のエラー行をそのまま示し、該当する行と直し方を平易な言葉で添えます（この例なら「5行目の `defs` は `definitions` の誤り」）。構文エラーがある場合、型チェックと PO 生成は行われないので「未実行」と書きます。

## ステップ3：型チェック

**目的**：型の定義と参照の整合性を確認

型チェックは、ステップ2のコマンド（`vdmj.sh -vdmsl spec.vdmsl`）で構文チェックに続けて実行されています。別のコマンドは要りません。その出力の `Type checked` の行と、その前に出る `Error` / `Warning` の行を読みます。型チェックで検査されるのは、次のような点です：

- 全ての型参照が定義されているか
- 型の構造が一貫しているか
- 関数のシグネチャが正しいか
- 不変式の型が正しいか

型エラーが無くても `Warning` の行が出ることがあります（例：「よくある警告・指摘と修正例」の警告1）。警告は読み飛ばさず、ステップ7の報告の「警告」に書きます。

**エラー例**（`decide` の戻り値の型を、定義されていない `Verdict` と書いた場合。VDMJ 4.7.0 で実測。終了コードは1）：
```text
Parsed 1 module in 0.02 secs. No syntax errors
Error 3430: Unable to resolve type name 'Verdict' in 'HybridJudgeAgent' (HybridJudgeAgent.vdmsl) at line 23:44
Type checked 1 module in 0.045 secs. Found 1 type error
Bye
```

報告では、VDMJ のエラー行をそのまま示し、平易な言葉で説明を添えます（この例なら「23行目で使っている型 `Verdict` が定義されていない。定義されている型は `Score`・`Threshold`・`Action`・`Ticket`」）。

### 3b. 証明責務（PO）の生成（型チェックが成功したら、レビューの前に実行する）

型チェックが成功したら、続けて PO を生成します。ステップ4・5のレビューとステップ7の報告は、この出力を参照します。

```bash
vdmj.sh -vdmsl spec.vdmsl -p
```

**出力例**（ステップ4以降の例で使う `HybridJudgeAgent` の仕様では7件。VDMJ 4.7.0 で実測。そのうちの2件）：
```text
Generated 7 proof obligations:

Proof Obligation 2: (Unproved)
Score: invariant satisfiability obligation in 'HybridJudgeAgent' (HybridJudgeAgent.vdmsl) at line 10:5
exists s : nat1 & (s <= 100)

Proof Obligation 6: (Unproved)
decide; post_decide: postcondition obligation in 'HybridJudgeAgent' (HybridJudgeAgent.vdmsl) at line 23:1
(forall ticket:Ticket, t1:Threshold, t2:Threshold &
  pre_decide(ticket, t1, t2) => post_decide(ticket, t1, t2, (if ((ticket.complexity_score) > t1) then <OperatorOnly> elseif ((ticket.complexity_score) > t2) then <OperatorAndLLM> else <AutoReply>)))
```

- `-p` は PO を生成するだけで、証明しません。状態はすべて `Unproved` です。
- 以降のステップと報告では、PO を VDMJ の番号（`Proof Obligation 6`）と種類の名前（`postcondition obligation`）で参照します。独自の番号や名前を付けません。
- 構文エラー・型エラーがあった場合は、このコマンドを実行せず、ステップ7で「PO生成: 未実行」と書きます。

## ステップ4：不変式のレビューと未証明事項の整理

**目的**：機械検査で確認できた型と、別の根拠が必要な充足性を整理する

型と状態に定義された`inv`（型の不変式と、`state` 定義の不変式の両方）について、型検査結果と読み取りによる分析を分ける。3b で生成した PO のうち不変式に関するもの（`invariant satisfiability obligation`、`state invariant obligation` など）は、VDMJ の番号のまま参照する。具体的な値を1つ確認しても、状態遷移による保存や要件の完全性は証明していない：

- 不変式の型が正しいか（`bool`を返すか）
- 不変式が実装可能か（満たす値が存在するか）
- 不変式が矛盾していないか

**記入例**（観点を示す例。この枠をそのまま出力せず、気づいた点をステップ7の報告形式の「不変式・契約のレビュー」に書く）：
```
不変式検証
==========

[1] Score = nat1 inv s == s <= 100
    ✓ 型: nat1 -> bool
    レビュー: 式を読む限り、例えば1が満たす。実行による確認は未実施
    関連するPO: Proof Obligation 2（invariant satisfiability obligation）は Unproved
    状態遷移での保存: 未証明

[2] Threshold = nat1 inv t == t <= 100
    ✓ 型: nat1 -> bool
    レビュー: 充足する値の候補はある。実行・証明は未実施

[3] WsMessage inv m == (複雑な論理式)
    ⚠ 警告: 不変式が複雑（30個以上の論理句）
    推奨：より小さな補助不変式に分割してください

型検査とレビューを分離して報告。充足性・状態遷移のPOは未証明
```

**警告例**：
```
⚠ 不変式が矛盾している可能性（行156）:

Confusing = nat1
inv x == x > 10 and x < 5;

この不変式を満たす自然数は存在しません。
確認：x > 10 AND x < 5 は常に偽です。
```

## ステップ5：契約レビュー

**目的**：実現可能性の候補と、実際に生成された未証明の責務を整理する

各関数・各操作について（状態を持つ仕様では、`operations` の各操作が対象になる）：

- 前提条件を満たす入力が存在するか
- 事後条件を満たす出力が存在するか
- 前提条件下で事後条件が必ず成立するか（証明責務）

**記入例**（観点を示す例。この枠をそのまま出力せず、気づいた点をステップ7の報告形式の「不変式・契約のレビュー」に書く）：
```
契約検証
========

[1] 関数: decide(ticket, t1, t2) -> Action

前提条件分析：
  pre t1 > t2
  （値域 1〜100 は Score / Threshold の不変式が表している）

  レビュー: 有効と思われる入力の候補（実行確認なし）
    例：ticket={id:1, complexity_score:50}, t1=80, t2=20

事後条件分析：
  post (ticket.complexity_score > t1 => RESULT = <OperatorOnly>) and
       (t2 < ticket.complexity_score and ticket.complexity_score <= t1
          => RESULT = <OperatorAndLLM>) and
       (ticket.complexity_score <= t2 => RESULT = <AutoReply>)

  レビュー: 3つの分岐を記述。全入力での実現可能性・実装の適合は未証明

関連するPO（3b の VDMJ の出力から、番号と種類をそのまま写す）:
  Proof Obligation 6: (Unproved)
  decide; post_decide: postcondition obligation
  意味: 前提条件 t1 > t2 のもとで、本体の結果が事後条件を満たすこと
  状態: Unproved のまま（レビューで「明らか」に見えても、証明済みとは書かない）
```

## ステップ6：設計文書のチェックリストレビュー

**目的**：設計文書の記載漏れや内部矛盾の候補を確認する。これは文書レビューであり、全要件の完全性や実装の適合を機械的に証明するものではない

VDM-SL仕様ファイルが参照する設計文書（PROTOCOL.md、API-SIGNATURES.md）について、以下を検証します。define-contract がこの2つを作るのは、エージェント間の通信がある場合だけです（保存先は仕様ファイルと同じディレクトリ）。単独のエージェントで2つとも無い場合は、欠落エラーにせずにこのステップ全体をスキップし、ステップ7の報告の「設計文書レビュー」に「対象なし（単独のエージェントのため設計文書なし）」と書きます。

### 6a. 設計文書の存在確認

**検証項目**：
- PROTOCOL.mdが存在し、必須セクションを含むか
- API-SIGNATURES.mdが存在し、全モジュールのAPIが記載されているか

**記入例**（観点を示す例。この枠をそのまま出力せず、結果はステップ7の報告形式の「設計文書レビュー」に書く）：
```
設計文書の存在確認
================

[1] PROTOCOL.md
    ✓ ファイル存在: あり
    ✓ 必須セクション:
      - メッセージ型レジストリ: ✓
      - ペイロード構造定義: ✓
      - 通信方向規約: ✓
      - 命名規約: ✓
    ✓ 行数: 347行
    ✓ エンコーディング: UTF-8

[2] API-SIGNATURES.md
    ✓ ファイル存在: あり
    ✓ モジュール数: 3個
      - HybridJudgeAgent: ✓
      - OperatorReplyHandler: ✓
      - StateTransitionManager: ✓
    ✓ 各モジュール: パラメータ名・型が記載
    ✓ 行数: 212行
    ✓ エンコーディング: UTF-8

検証結果: 全ての必須設計文書が存在
```

**エラー例**（エージェント間の通信があるのに設計文書が無い場合、または2つのうち片方だけがある場合。単独のエージェントで2つとも無いのはエラーではない）：
```
❌ ファイル欠落

PROTOCOL.mdが見つかりません：
  期待されるパス: /path/to/agents/PROTOCOL.md（仕様ファイルと同じディレクトリ）
  現在の状態: ファイルなし

修正：
  1. PROTOCOL.mdを作成してください
  2. メッセージ型、ペイロード構造、通信方向を記載してください
```

### 6b. PROTOCOL.mdの完全性検証

**検証項目**：
- すべてのメッセージ型がメッセージ型レジストリに記載されているか
- ペイロード構造がすべてのフィールド定義を含むか
- 通信方向が明記されているか

**記入例**（観点を示す例。この枠をそのまま出力せず、結果はステップ7の報告形式の「設計文書レビュー」に書く）：
```
PROTOCOL.md 完全性検証
====================

メッセージ型レジストリ：
  [1] TicketCreate (Client → Server)
      定義あり ✓ - 必須フィールド確認
      ペイロード構造記載: ✓
      
  [2] TicketUpdate (Client → Server)
      定義あり ✓
      ペイロード構造記載: ✓
      
  [3] ReplyManual (Operator → Server)
      定義あり ✓
      ペイロード構造記載: ✓
      
  [4] AutoReply (Server → Client)
      定義あり ✓
      ペイロード構造記載: ✓

ペイロード構造例：
  TicketCreatePayload:
    - ticket_id: string (required)
    - title: string (required)
    - content: string (required)
    - priority: number (0-10, required)
    - nullable フィールド: なし ✓

命名規約チェック：
  ✓ メッセージ型: PascalCase (TicketCreate, AutoReply等)
  ✓ ペイロード型: {MessageType}Payload 形式
  ✓ フィールド: snake_case (ticket_id, msg_type等)
  ✓ 状態値: ALL_CAPS (CREATED, IN_PROGRESS等)

検証結果: PROTOCOL.md は完全で矛盾なし
```

**エラー例**：
```
❌ メッセージ型未記載 (PROTOCOL.md 行 34)

VDM-SL では以下のメッセージ型が定義されています：
  - TicketCreate
  - TicketUpdate
  - EscalationRequest
  - ReplyManual
  - MarkComplete
  - EscalateOperator ← PROTOCOL.md に記載されていません

修正：PROTOCOL.md メッセージ型レジストリに以下を追加してください：
  | EscalateOperator | Operator → Server | 操作者がチケットをシステム外にエスカレート |
```

### 6c. API-SIGNATURES.mdの完全性検証

**検証項目**：
- VDM-SLで定義された全モジュールのAPI（関数シグネチャ）が記載されているか
- パラメータ名、型情報が完全か
- 戻り値型が記載されているか

**記入例**（観点を示す例。この枠をそのまま出力せず、結果はステップ7の報告形式の「設計文書レビュー」に書く）：
```
API-SIGNATURES.md 完全性検証
===========================

HybridJudgeAgent モジュール:
  関数 [1] decide(ticket, t1, t2) → Action
      VDM-SL定義: decide : Ticket * Threshold * Threshold -> Action
      API記載: ✓
        パラメータ: ticket (Ticket型), t1 (Threshold: nat1, 1-100), t2 (Threshold: nat1, 1-100)
        戻り値: Action (<AutoReply> | <OperatorAndLLM> | <OperatorOnly>)
        説明: チケットとスコアから判定アクションを決定
      
  関数 [2] scoreAll(scores) → seq of Score
      VDM-SL定義: scoreAll : seq of Score -> seq of Score
      API記載: ✓
        パラメータ: scores (seq of Score)
        戻り値: seq of Score
        説明: スコア列を処理して出力スコア列を返す

  関数 [3] explainDecision(action) → seq1 of char
      VDM-SL定義: explainDecision : Action -> seq1 of char
      API記載: ✓ 一致

OperatorReplyHandler モジュール:
  [1] processReply(msg) → Result ✓
  [2] validatePayload(payload) → bool ✓
  [3] sendToClient(msg, client_id) → void ✓

StateTransitionManager モジュール:
  [1] validTransition(from, to) → bool ✓
  [2] getValidNextStates(current_state) → set of TicketStatus ✓

検証結果: 全モジュール API が記載され、完全です
```

**エラー例**：
```
❌ API 未記載 (API-SIGNATURES.md)

VDM-SL で以下の関数が定義されていますが、API-SIGNATURES.md にはありません：

関数: validateTicketCreate(ticket : Ticket) → bool
      VDM-SLファイル行: 145-152
      必要な API エントリ:
        - パラメータ名と型
        - 戻り値型
        - 簡潔な説明

修正：API-SIGNATURES.md に以下を追加してください：
  #### validateTicketCreate
  - **Parameters**: ticket (Ticket)
  - **Returns**: bool
  - **Description**: チケットが作成条件を満たすかを検証
```

### 6d. VDM-SL定義との相互参照検証

**検証項目**：
- PROTOCOL.mdで定義されたメッセージ型がVDM-SLドメイン型と対応しているか
- API-SIGNATURES.mdのパラメータ型がVDM-SL関数シグネチャと一致しているか
- 状態値がPROTOCOL.mdとVDM-SLで同一か

**記入例**（観点を示す例。この枠をそのまま出力せず、結果はステップ7の報告形式の「設計文書レビュー」に書く）：
```
VDM-SL定義との対応検証
====================

ドメイン型対応：
  VDM-SL定義: TicketStatus = <Created> | <Assigned> | <InProgress> | <Resolved> | <Closed>
  PROTOCOL.md参照: チケット状態の定義
    - CREATED ✓
    - ASSIGNED ✓
    - IN_PROGRESS ✓
    - RESOLVED ✓
    - CLOSED ✓
  対応状態: 完全一致

  VDM-SL定義: Score = nat1 inv s == s <= 100
  PROTOCOL.md参照: スコア範囲
    記載: "スコアは 1 から 100 の自然数"
  対応状態: 一致 ✓

関数シグネチャ対応：
  VDM-SL: decide : Ticket * Threshold * Threshold -> Action
  API-SIGNATURES.md: decide(ticket: Ticket, t1: Threshold, t2: Threshold) -> Action
  対応状態: パラメータ名と型が一致 ✓

検証結果: VDM-SL定義と設計文書が完全に対応
```

**エラー例**：
```
❌ 型不一致 (VDM-SL vs 設計文書)

VDM-SL で定義されたメッセージ型：
  AllMsgType = UserMsgType | OperatorMsgType | ServerToUserMsgType

PROTOCOL.md に記載されたメッセージ型:
  TicketCreate, TicketUpdate, ReplyManual, AutoReply, OperatorReply
  (計 5個)

ただし VDM-SL でも 5個のメッセージしか定義されていないため、実際には矛盾がありません。

警告: より詳細に検証するため、メッセージ型定義セクションを再確認してください。
```

### 6e. 命名規約と可null性の一貫性

**検証項目**：
- 命名規約がPROTOCOL.md内で一貫しているか（snake_case, PascalCaseの混在がないか）
- nullable フィールドが PROTOCOL.md で明記されているか
- 設計文書と実装の命名が対応しているか

**記入例**（観点を示す例。この枠をそのまま出力せず、結果はステップ7の報告形式の「設計文書レビュー」に書く）：
```
命名規約・可null性検証
===================

命名規約の一貫性：
  ✓ メッセージ型: PascalCase
    TicketCreate, TicketUpdate, AutoReply, OperatorReply
  
  ✓ ペイロード型: {Type}Payload 形式
    TicketCreatePayload, TicketUpdatePayload, AutoReplyPayload
  
  ✓ フィールド名: snake_case
    ticket_id, msg_type, timestamp, priority_level
  
  ✓ 状態値: ALL_CAPS
    CREATED, IN_PROGRESS, RESOLVED, CLOSED

可null性の注釈：
  ✓ TicketCreatePayload.description: nullable (✓ 注釈あり)
  ✓ OperatorReplyPayload.notes: nullable (✓ 注釈あり)
  ✓ その他全フィールド: required (✓ 注釈一貫)

設計文書の一貫性チェック：
  ✓ PROTOCOL.md での定義と API-SIGNATURES.md の記載が対応
  ✓ フィールド名の一貫性: 100% 一致

検証結果: 命名規約が統一されており、可null性が明記されている
```

**エラー例**：
```
❌ 命名規約の混在 (PROTOCOL.md 行 78)

ペイロード型の定義でケースが混在しています：

× TicketCreatePayload:
    - ticket_id (snake_case)
    - TicketStatus (PascalCase) ← 不一貫
    - messageType (camelCase) ← 不一貫

修正：すべてのフィールドを snake_case に統一してください：
  ✓ ticket_id
  ✓ ticket_status
  ✓ message_type
```

## ステップ7：証明責務の整理と報告

**目的**：実行した検査の結果と、形式証明が必要なまま残っている事項を、1つの報告にまとめて開発者に提示

3b で VDMJ が生成した証明責務（PO: Proof Obligation）について、以下をまとめます：

- 件数と、種類ごとの内訳。種類の名前は VDMJ の出力のまま書く（例：`subtype obligation`、`map apply obligation`、`invariant satisfiability obligation`、`operation postcondition obligation`）
- ステップ4・5のレビューで、内容を確認しておきたいと判断した PO（VDMJ の番号で示す）。レビューは PO の状態を変えない

**最終報告は、次の報告形式1つにまとめます。** ステップ2〜6の「出力例」「記入例」の見出しや枠を並べて出力しません。`< >` は実際の値に置き換え、該当が無い欄も省かずに「なし」と書きます。

**報告形式**（値は実行ログから埋め、実行していない項目は未実行とする）：
```
入力: <path, sha256>
ツール: <VDMJ version>
コマンド・終了コード・ログ: <実行証拠>
構文検査: <成功/失敗/未実行/実行エラー>
型検査: <成功/失敗/未実行/実行エラー>
警告: <VDMJ が出力した Warning の行と、平易な説明 | なし>
PO生成: <成功/失敗/未実行>、件数: <実測値>
POの内訳: <VDMJ が出力した種類名ごとの件数。状態はすべて Unproved>
PO証明: 未実行（PO生成と区別）
不変式・契約のレビュー: <ステップ4・5で気づいた点と、関連する PO の番号。仕様を読んだ結果であり、VDMJ の検査結果ではない | 指摘なし>
設計文書レビュー: <対象項目と指摘。機械証明ではない | 対象なし（単独のエージェントのため設計文書なし）>
実装テスト: 未実行（この報告の時点。ステップ8で既存のテストを実行した場合は、その結果を別に報告する）
未確認: <要件の完全性、実装の適合、未対応構文など>
```

POの識別子・式・状態はVDMJの出力をそのまま参照する。「自明」「証明できそう」というレビューで `Unproved` を証明済みに変えない。smt-verifyを実行した場合も、翻訳した命題の結果と元POへの対応確認を分ける。要件漏れがないことや実装全体の正しさを総合的な「PASSED」で表さない。

## ステップ8：次のステップの提案

**目的**：検査の結果と、すでにある成果物に合わせて、次の一歩を提案する

構文・型検査が成功し、未証明のPOを記録して報告したら、仕様ファイルと同じディレクトリを見て、次の表の**最初に当てはまる行**を提案します。generate-code は実装を仕様ファイルと同じディレクトリの `generated/` に出力し、generate-tests はそれを import するテストを書きます（既定の置き場所は `tests/`）。

| 見つかったもの | 提案すること |
|---|---|
| `generated/` が無い | 「この仕様からTypeScriptコードを生成して」（generate-code）。実装が無い段階で、テスト生成を案内しない |
| `generated/` はあるが、それを import するテストが無い | 「契約テストを生成して」（generate-tests）。下の提案例を使う |
| `generated/` も、それを import するテストも既にある | テストの作り直しは提案しない。既存のテストを実行するかどうかを尋ねる。実行コマンドは `package.json` の `scripts.test` か、テストファイルの先頭のコメントから読む（読み取れなければ、推測せずに尋ねる）。実行した場合は、コマンド・終了コード・件数を「実装テスト」の結果として、VDMJ の結果と分けて報告する。有限個のテストが通っても、PO は `Unproved` のまま |

どの行に当てはまる場合も、`Unproved` の PO が残っていれば（PO生成だけでは必ず残る）、PO の追加確認を選択肢として添えます。どちらも任意で、ユーザーが選んだ場合だけ実行します：

- **QuickCheck**（配布版の `vdmj.sh` を使っている場合のみ。単体 jar では `qc` コマンドが使えない）：`vdmj.sh -vdmsl spec.vdmsl -cmd "qc"`。PO ごとに `PROVABLE` / `MAYBE` / `FAILED` / `TIMEOUT` が出力される。実行した場合は、それぞれの件数と、`FAILED` になった PO の番号・反例を、VDMJ の出力のまま「PO証明」とは別の行（`QuickCheck: ...`）で報告する。`MAYBE` は反例が見つからなかったという意味で、証明ではない。`PROVABLE` は、QuickCheck の戦略（行に `by direct`・`by witness`・`by trivial` などと出る）がその PO を成り立つと判定した、という VDMJ の出力である。件数と PO の番号を `QuickCheck:` の行にそのまま書き、「証明済み」などと言い換えない。QuickCheck を実行しても、「PO証明: 未実行」の行は変えない。VDMJ は判定ごとの合計を出力しないので、件数は PO ごとの行を数えて書く
- **smt-verify スキル**（Z3 が必要）：PO を SMT-LIB に翻訳して Z3 で調べる。結果は翻訳した命題についてのもので、元の PO との対応確認は別に行う

テスト生成を提案する場合の例（項目は実際の仕様の型名・関数名・操作名から書く）：

```
提案：この仕様からユニットテストを自動生成しますか？

generate-tests スキルが以下のテストを生成します：

1. 型不変式テスト（Score, Threshold）
2. 前提条件テスト（t1 > t2の検証）
3. 事後条件テスト（判定ロジック3ケース）
4. プロトコルテスト（メッセージ整合性、状態遷移。PROTOCOL.md / API-SIGNATURES.md がある場合のみ）
5. エッジケーステスト（境界値）

実行：[generate-tests スキルを実行]
```

## エラーレベルと対応

| レベル | 例 | 対応 |
|--------|-----|------|
| エラー❌ | 構文エラー、未定義型の参照 | 修正必須。VDMファイルが無効 |
| 警告⚠️ | 複雑な不変式、到達不可能な状態 | 推奨修正。仕様は有効だが改善余地あり |
| 情報ℹ️ | 検証完了、統計情報 | 参考情報。対応不要 |

## よくある警告・指摘と修正例

### 警告1：型に定義されていない値との比較

VDMJ 4.7.0 は、これを型エラーではなく警告（Warning 3087）として出します（実測）。型チェックが「No type errors」でも、警告を読みます。

```text
⚠️ 警告 3087（行45）: Left and right of '=' are incompatible types
  post ticket.complexity_score > t1 => RESULT = <UnknownAction>;
                                                ^^^^^^^^^^^^^^^
  Left: Action
  Right: <UnknownAction>
  Action に定義されている値: <AutoReply>, <OperatorAndLLM>, <OperatorOnly>
```

**修正**：
```vdm-sl
-- ✓ 修正後（Action に定義されている値を使う。戻り値は RESULT で参照する）
types
  Action = <AutoReply> | <OperatorAndLLM> | <OperatorOnly>;

  Ticket ::
    complexity_score : nat1;

functions
  decide : Ticket * nat1 * nat1 -> Action
  decide(ticket, t1, t2) ==
    if ticket.complexity_score > t1 then <OperatorOnly>
    elseif ticket.complexity_score > t2 then <OperatorAndLLM>
    else <AutoReply>
  pre t1 > t2
  post ticket.complexity_score > t1 => RESULT = <OperatorOnly>;
```

### 指摘1：不変式が常に偽

これはレビューでの指摘です。VDMJ 4.7.0 の構文チェック・型チェックは、この定義をエラーにしません（実測）。

```text
❌ 指摘（行12）:
  Score = nat1
  inv s == s <= 100 and s > 200;
                        ^^^^^^^
  この不変式を満たす自然数は存在しません。
```

**修正**：
```vdm-sl
-- ✓ 修正後
types
  Score = nat1
  inv s == s <= 100;
```

### 指摘2：複雑な不変式

```text
⚠️ 指摘（行78）:
  WsMessage ::
    ...
  inv m == ... (35個の論理句)
  
  推奨：不変式が複雑すぎます。
```

**修正戦略**：
```vdm-sl
-- ✓ 補助関数に分割し、型定義の inv から呼び出す。
--   補助関数の引数は、レコード全体（WsMessage）ではなくフィールドにする
types
  MsgType = <TicketCreate> | <AutoReply>;

  TicketCreatePayload ::
    title : seq1 of char;

  AutoReplyPayload ::
    reply_text : seq1 of char;

  Payload = TicketCreatePayload | AutoReplyPayload;

  WsMessage ::
    msg_type : MsgType
    payload  : Payload
  inv m ==
    isValidTicketCreateMsg(m.msg_type, m.payload) and
    isValidAutoReplyMsg(m.msg_type, m.payload);

functions
  isValidTicketCreateMsg : MsgType * Payload -> bool
  isValidTicketCreateMsg(msg_type, payload) ==
    msg_type = <TicketCreate> => is_TicketCreatePayload(payload);

  isValidAutoReplyMsg : MsgType * Payload -> bool
  isValidAutoReplyMsg(msg_type, payload) ==
    msg_type = <AutoReply> => is_AutoReplyPayload(payload);
```

不変式は `inv パターン == 式` の形で型定義に付属させます。型定義の外に単独で `inv` を書くことはできません。

補助関数の引数を `WsMessage` そのものにしない理由：`WsMessage` の不変式の中から `WsMessage -> bool` の関数を呼ぶと、VDMJ は「不変式を確かめている途中の値が、すでに `WsMessage` の不変式を満たしていること」という PO（subtype obligation）を生成し、QuickCheck が反例を出します（VDMJ 4.7.0 で実測：PO 4件のうち、この subtype obligation 2件を含む3件が `FAILED`）。上のようにフィールドを渡す形では、PO は2件で、QuickCheck の結果は `MAYBE` 1件・`PROVABLE` 1件、`FAILED` 0件でした（実測）。

## トラブルシューティング

### Q: VDMJツールが見つからない
**A**: ステップ1b の順で確かめます。`command -v vdmj.sh` が何も表示しない場合は、`vdmj.sh` の場所（VDMJ の配布版 ZIP を展開したディレクトリ）をユーザーに尋ね、その絶対パスで起動します。まだ入れていない場合は、`references/vdmj-setup.md` を読み、その手順（Java 11 以上と、[VDMJ GitHub](https://github.com/nickbattle/vdmj) の配布版 ZIP）を回答の中で伝えます（ユーザーはこのファイルの場所を知らないので、ファイル名だけを示さない）。`export PATH=...` は実行したシェルの中でしか効かないので、PATH に追加して使う場合は、シェルの設定ファイル（zsh なら `~/.zshrc` など）に書き、新しく起動したシェルで `command -v vdmj.sh` がパスを表示することを確かめます。

### Q: レコード型を set の要素にできるか
**A**: できます。`set of Task` のようにレコード型を集合の要素にできます（等価性は構造的に判定されます）。

### Q: 証明責務が多すぎる
**A**: PO の件数は、部分関数・部分操作（事前条件付きの呼び出し、`hd`、`m(k)` などの部分演算）、サブタイプ（`nat1`、`inv` 付きの型）、量化子（`forall`、`exists`）の使用量で決まります。事前条件を強化しても PO は消えません。呼び出し側に「事前条件を満たすこと」の責務が移るだけです。

件数ではなく PO の種類ごとに確認してください：
- 型健全性（subtype）：値域の狭い型への代入や戻り値。多くは設計上の意図を反映しており、妥当性のレビュー対象
- 部分関数の適用（partial function / map application）：引数が定義域にあることの確認。仕様に `pre` を追加する判断材料
- 事前条件・事後条件の充足可能性（satisfiability）：契約そのものの矛盾の有無。優先して確認
- 不変式の保存（invariant）：状態遷移の各ステップで壊れていないか

種類ごとに分類し、未証明のまま残す PO を明示して報告します。

## VDMJコマンド参照

配布版 ZIP（`vdmj-suite-<version>-<build>-distribution.zip`）に同梱の起動スクリプト `vdmj.sh` を使う。QuickCheck は suite 版でのみ使える（Maven の単体 jar は `java -jar <vdmj.jar>` で構文・型チェックと PO 生成のみ）。セットアップは `references/vdmj-setup.md` を参照。`vdmj.sh` が PATH に無い場合は、ステップ1b で確かめた絶対パスに置き換える。

**ログと入力ハッシュ**：ステップ7の報告に書く「入力」「コマンド・終了コード・ログ」のために、検査の出力をファイルに保存します。保存先は、仕様ファイルと同じディレクトリの `evidence/`（無ければ作る。ユーザーが別の場所を指定した場合はそれに従う）。仕様ファイルのあるディレクトリで、次の形で実行します（macOS で実測）：

```bash
mkdir -p evidence
shasum -a 256 spec.vdmsl                  # 入力のハッシュ。shasum が無い環境では sha256sum spec.vdmsl
vdmj.sh -vdmsl spec.vdmsl > evidence/vdmj-typecheck.txt 2>&1; echo "exit=$?"
vdmj.sh -vdmsl spec.vdmsl -p > evidence/vdmj-po.txt 2>&1; echo "exit=$?"
```

終了コードだけでなく、保存したログの中身も読みます（終了コード0でも、ログにエラーや警告の行が出ていることがある）。

コマンドの一覧：

```bash
# 構文チェック＋型チェック（デフォルト動作。ファイルは引数で渡す）
vdmj.sh -vdmsl spec.vdmsl

# 証明責務（PO）生成
vdmj.sh -vdmsl spec.vdmsl -p

# QuickCheck（PO ごとに PROVABLE / MAYBE / FAILED / TIMEOUT を判定し終了）
vdmj.sh -vdmsl spec.vdmsl -cmd "qc"

# インタープリタ起動（型チェック成功後に対話モード）
vdmj.sh -vdmsl spec.vdmsl -i

# 式を評価して終了
vdmj.sh -vdmsl spec.vdmsl -e "式"
```

## 参考資料

- VDM-SL仕様：ISO/IEC 13817-1
- VDMJ ドキュメント：[VDMJ User Guide](https://github.com/nickbattle/vdmj/wiki)
- 形式手法のベストプラクティス：`../formal-methods-guide/SKILL.md`
- 仕様定義スキル：`../define-contract/SKILL.md`
- テスト生成スキル：`../generate-tests/SKILL.md`
