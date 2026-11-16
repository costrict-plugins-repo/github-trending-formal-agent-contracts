# Formal Agent Contracts

**バージョン 2.2.0** ｜ マルチエージェント開発における形式手法ツールキット。エージェント間の契約をVDM-SLで定義し、自動検証する。

形式手法の知識がない開発者でも、Claudeの支援により：

- エージェント間のインターフェースを厳密に定義できる（VDM-SL）
- エージェント同士が通信する場合は、設計文書（PROTOCOL.md、API-SIGNATURES.md）も生成し、仕様と実装の距離を縮められる
- VDMJによる構文チェック・型チェック・証明責務（PO）生成を実行できる（Java と VDMJ が必要）
- POから翻訳したSMT命題をZ3で確認し、反例候補を探索できる（元POとの意味の対応・実装適合は別途確認）
- 仕様の型・不変条件からDBスキーマ（DDL）を導出し、乖離（DEVIATIONS）と担保箇所（TRACEABILITY）を記録できる
- 仕様からTypeScript/Pythonのコードスキャフォールドと契約テストを生成できる（Java 不要。TypeScript は空のディレクトリからテストの実行まで進められる → [クイックスタート](#クイックスタート)）
- 既存コードから仕様を逆抽出し、対話で磨き上げ、コードと照合できる（リバースワークフロー）
- モジュールごとに「能力が足りる範囲で最も軽いモデル」を割り振り、生成フェーズのトークン消費を抑えられる（契約駆動モデルルーティング、v2.2.0）

## 確認できる範囲

仕様記述、VDMJによる構文・型検査とPO生成、翻訳したSMT命題の結果、実装の有限テストを分けて報告します。PO生成は証明ではなく、SMTの `unsat` は翻訳や生成実装の正しさまで証明しません。未実行・未対応・unknown・timeout・実行エラーを合格に含めません。結果には入力・ツール・コマンド・ログ・仮定・未確認範囲を残します。

[TaskManager基準例](examples/task-manager/README.md) は配布実装を直接テストします。再現手順と意味の差分を確認してください。

## インストール

<!-- install-block:start -->
Claude Code で次の2行を実行します（Anthropic のコミュニティマーケットプレース経由）。

```
/plugin marketplace add anthropics/claude-plugins-community
/plugin install formal-agent-contracts@claude-community
```

最新版をすぐ使いたい場合は、このリポジトリを直接マーケットプレースとして追加します。

```
/plugin marketplace add kotaroyamame/formal-agent-contracts
/plugin install formal-agent-contracts@formal-agent-contracts
```
<!-- install-block:end -->

コミュニティカタログは特定のコミットに固定されており、反映に時間差があります。そのため、コミュニティ経路で入る版が、この README の説明より前のものであることがあります。下の確認でそう分かったときは、リポジトリ経由の2行で入れ直してください。

**インストールの確認**: Claude Code で次のように聞きます。

```
formal-agent-contracts プラグインのスキルを一覧して。define-contract と generate-tests の説明文も見せて
```

- スキルが15より少ない場合は、v2.2.0 より前の版が入っています。
- 15スキルが挙がっても、それだけでは[クイックスタート](#クイックスタート) A が前提とする版かどうかは分かりません（スキルの数は v2.2.0 から変わっていません）。define-contract の説明文に「`.vdmsl` ファイルに保存」、generate-tests の説明文に「Javaは不要」とあれば、A が前提とする版（define-contract 2.1.0・generate-tests 2.2.0 以降）です。どちらも無ければ、それより前の版が入っています。

## クイックスタート

### A. Java なしで試す（目安10分）

必要なものは Claude Code、このプラグイン、Node.js 22.18 以上です（下の選択肢 (b) が使う型ストリッピングが既定で有効な版。23 系なら 23.6 以上）。Java は不要です。この手順は、define-contract 2.1.0・generate-code 0.4.1・generate-tests 2.2.0 以降のスキルを前提にしています（確かめ方は上の「インストールの確認」）。空のディレクトリで Claude Code を起動し、3つのプロンプトを順に送ります。

以下の「試行」は、エージェントがスキルの文面に従って Claude Code の役を演じた模擬試行を指します（記録: [docs/onboarding-tests/](docs/onboarding-tests/)）。人が操作・計時したものではなく、「10分」は目安です。上の「インストールの確認」を含め、プラグインを読み込んだ実際の Claude Code セッションでの通し実行もまだありません。試行で使った Node.js は v26.4.0 だけです。

**1. 契約を定義する**

```
タスク管理エージェントの契約を定義して。
- タスクにはID・タイトル・ステータス（未着手/進行中/完了）がある
- タイトルは1文字以上100文字以下
- 存在しないタスクは更新も削除もできない
```

define-contract は、依頼文から読み取れなかった点だけを、平易な言葉で1回にまとめて質問します。試行での例:

- 「どの操作が必要ですか？依頼文の『更新』は何を変える操作ですか？（推奨：タスク作成・ステータス変更・削除・一覧取得）」
- 「IDはどう付けますか？削除したIDを後で再利用しますか？（推奨：1から自動で採番し、再利用しない）」
- 「同じタイトルのタスクを複数作れますか？（推奨：作れる）」

「おまかせ」と答えて構いません。既定値で決めた項目は完了報告の「決めたこと」に列挙されるので、後から訂正できます。仕様は `<モジュール名>.vdmsl`（試行では `TaskManager.vdmsl`）としてカレントディレクトリに保存されます。

**2. コードを生成する**

```
この仕様からTypeScriptコードを生成して
```

generate-code が、仕様の隣の `generated/` に `types.ts`・`contracts.ts`・`task-manager.ts`（モジュール名から決まる）・`index.ts` を書きます。事前条件・事後条件・不変条件は実行時チェックとして入ります。完了報告に、export された名前と呼び出し例（正常な呼び出しと契約違反の呼び出し）が載ります。

**3. 契約テストを生成して実行する**

```
契約テストを生成して
```

テストランナーがまだ無いので、generate-tests が実行方法を1回だけ質問します。

- (a) Vitest の最小構成を作る（推奨）: npm から Vitest をこのフォルダにインストールする（ネットワーク接続が必要。`package.json`・`package-lock.json`・`node_modules/` ができる）。インストールされる Vitest が対応を宣言していない版の Node.js では、npm が警告（`EBADENGINE`）を出す。試行時点の Vitest では 23 系と 25 系がこれに当たり、その版では Vitest を使わない (b) を選べる
- (b) 依存ゼロ: 何もインストールせず、Node.js 組み込みのテストランナーで実行する
- (c) テストファイルだけ生成する: インストールも実行もしない

テストは `tests/task-manager.test.ts`（モジュール名から決まる）に書かれます。(a) か (b) を選ぶと、スキルはテストを書いて自分で実行し、完了報告に実行コマンドを1つ（(a) なら `npm test`）と結果の件数を載せます。同じコマンドを自分でも実行して確かめてください。

**ここまでで分かること・分からないこと**

- 分かること: 生成された実装が、契約から導いた有限個のテストに通ること。実行時の契約チェックが不正な呼び出しを拒否すること。試行では、存在しないIDの削除が `ContractError: [Contract Violation] Pre-condition failed: id 999 not in dom tasks` で拒否されました。
- 分からないこと: 仕様そのものが正しいかどうか。仕様は LLM が書いたもので、構文チェックも型チェックも通していません。テストも同じ LLM が同じ仕様から導いたものです。全部通っても機械検証ではありません。

**同梱の参照例を実行する（Claude 不要）**: Node.js 22 以上があれば、同梱の TaskManager 例をそのまま実行できます（この例は TypeScript を先にコンパイルしてから実行するので、A の「22.18 以上」という条件は当てはまりません）。

```sh
git clone https://github.com/kotaroyamame/formal-agent-contracts.git
cd formal-agent-contracts
npm ci --ignore-scripts
npm run test:example
```

[examples/task-manager](examples/task-manager/README.md) の実装とテストをコンパイルし、実行時の契約チェックを有効にして Node.js のテストランナーで実行します。`npm ci` はこのリポジトリの開発用の依存パッケージをまとめてインストールするので、最後に npm の監査（audit）や非推奨（deprecated）の警告が表示されることがあります。この例の実行に使うのは、そのうち TypeScript コンパイラと Node.js の型定義だけです。

この例のファイル構成は、A の手順で生成されるものとは違います（現在の generate-code・generate-tests の出力形式になる前に作られた例です）。A が生成する構成の実物は [docs/onboarding-tests/2026-11-10-t1-vitest/](docs/onboarding-tests/2026-11-10-t1-vitest/) にあります。

### B. 仕様を機械で検査する（Java と VDMJ が必要）

Java 11 以上と VDMJ（配布版 ZIP）を入れます（手順: [vdmj-setup.md](skills/verify-spec/references/vdmj-setup.md)）。その後、A と同じディレクトリで次を送ります。

```
仕様を検証して
```

verify-spec が VDMJ で構文チェック・型チェック・証明責務（PO）の生成を行い、結果を平易な言葉で説明します。PO は「成り立つことを示す必要がある条件」の一覧で、生成は証明ではありません（未証明のまま）。`vdmj.sh` が PATH に無ければ場所（ZIP の展開先）を1回尋ねます。

- 模擬試行は2回です（[記録](docs/onboarding-tests/2026-11-11-round3-and-verify-spec.md)）。作者の手元に導入済みの Java と VDMJ で PO の生成と報告まで進みました。導入手順どおりに入れる実行は未試行です。
- 報告後、QuickCheck（反例探索）を任意で提案します（2回目の試行で1回実行）。1コマンドのインストーラは[まだありません](#今後の予定)。
- 欠陥を見つけたときの見え方: [TaskManager 例](examples/task-manager/README.md#what-the-recorded-run-shows)。ほかの始め方: [prompt-templates.md](prompt-templates.md)。

## スキル一覧（全15スキル）

「必要なもの」は、Claude Code とこのプラグインのほかに要る外部ツールです。

### フォワード開発（仕様 → コード）

| スキル | 説明 | 必要なもの |
|---|---|---|
| **define-contract** | 自然言語の依頼からVDM-SL契約を書き、`.vdmsl` ファイルに保存。読み取れない点だけを平易な言葉で1回にまとめて質問する。エージェント同士が通信する場合のみ、設計文書（PROTOCOL.md、API-SIGNATURES.md）も生成 | なし |
| **verify-spec** | VDMJによる構文チェック・型チェック・PO生成。設計文書（PROTOCOL.md、API-SIGNATURES.md）がある場合は、記載漏れや仕様との不整合の候補を確認する文書レビューも行う（機械的な証明ではない） | Java + VDMJ |
| **smt-verify** | POをSMT-LIBに翻訳し、Z3で命題の充足性を確認（反例候補の探索） | Java + VDMJ、Z3 |
| **generate-db-schema** | VDM-SLの型・不変条件からDBスキーマ（DDL）を規則的に導出。表現しきれない乖離は DEVIATIONS（retrenchment表）、担保箇所は TRACEABILITY に記録 | なし（DDLの実行確認は sqlite3 か PostgreSQL、任意） |
| **generate-code** | VDM-SL仕様からTypeScript/Pythonのコードスキャフォールドを生成（事前条件・事後条件・不変式のランタイム検証コード付き） | なし（生成コードの実行に Node.js か Python） |
| **generate-tests** | VDM-SL仕様（と、あれば設計文書）から契約テストを生成し、実行コマンドを1つ示す（型不変式・契約遵守・状態遷移・境界値）。既存のテストランナー（Vitest/Jest/Mocha/node:test）があればそれに合わせ、無ければ最小構成を提案する | Node.js（テストの実行） |
| **integrated-workflow** | 定義→検証→SMT確認→コード生成→テストの5フェーズを一気通貫で実行 | Java + VDMJ（検証フェーズ）、Node.js か Python（テストの実行。TypeScript のスモークテストは、条件が合えば `node` だけで実行し、何も取得しない。条件は、型ストリッピングが有効な Node.js（クイックスタート A と同じ）、generate-code の既定の出力、直近の `package.json` が `"type": "commonjs"` でないこと。それ以外はプロジェクトの TypeScript ランナーを使い、`npx tsx` は npm から取得する前に確認する）、Z3 は任意 |
| **route-models** | 契約の客観的な複雑度シグナル（暗黙的定義・不変条件・PO件数など）からモジュールごとに能力が足りる範囲で最も軽いモデル層（light/standard/heavy）を割り振り、生成フェーズのトークン消費を削減。検証ゲートは不変で、同一モジュールで2回検証に失敗した場合のみ自動で1層エスカレーション | なし |

### リバース開発（既存コード → 仕様）

| スキル | 説明 | 必要なもの |
|---|---|---|
| **extract-spec** | 既存コードから暫定VDM-SL仕様を抽出（対話の足場となる仮仕様） | なし |
| **refine-spec** | 対話を通じて仮仕様を磨き、ユーザーの頭の中にある「真の仕様」を引き出す | なし |
| **reconcile-code** | 確定した仕様と既存コードを項目ごとに照合し、差分レポート・修正・テストを生成 | なし（生成したテストの実行は対象プロジェクトのテスト環境） |
| **reverse-workflow** | 抽出→洗練→照合のリバースパイプラインを一気通貫で実行（フォワードパイプラインへの接続も可能） | なし（生成したテストの実行は対象プロジェクトのテスト環境）。任意のフォワード接続をする場合は integrated-workflow と同じ |

### 仕様の入出力

| スキル | 説明 | 必要なもの |
|---|---|---|
| **import-natural-spec** | 自然言語の仕様書（Markdown）を読み込み、曖昧さを対話で解消しながらVDM-SL仕様へ変換 | なし |
| **export-human-spec** | VDM-SL仕様から非エンジニアも読める自然言語仕様書（Markdown）を生成 | なし |

### リファレンス

| スキル | 説明 | 必要なもの |
|---|---|---|
| **formal-methods-guide** | VDM-SLの文法、型システム、PO種別などの背景知識を提供（他スキルからも参照される） | なし |

## セットアップ（外部ツール）

クイックスタート A に必要な外部ツールは Node.js だけです。Java と VDMJ は B（verify-spec）から、Z3 は smt-verify を使うときに入れてください。スキルごとの要否は、スキル一覧の「必要なもの」列にあります。

| ツール | 必要とするスキル | 入手先 |
|---|---|---|
| Node.js | generate-tests（テストの実行。テストランナーは既存のものに合わせ、無ければ用意の仕方を質問する）、generate-code・integrated-workflow（生成した TypeScript の実行。integrated-workflow のスモークテストの実行方法は、スキル一覧の integrated-workflow の行） | https://nodejs.org/ （版の条件はクイックスタート A） |
| Python 3 | generate-code・integrated-workflow で Python を生成する場合（生成コードの実行） | https://www.python.org/ |
| Java 11以上 | verify-spec、smt-verify、integrated-workflow の検証フェーズ、reverse-workflow のフォワード接続（VDMJの実行に必要） | https://adoptium.net/ |
| VDMJ | Java と同じ | https://github.com/nickbattle/vdmj/releases （`vdmj-suite-*-distribution.zip`）。詳細は [vdmj-setup.md](skills/verify-spec/references/vdmj-setup.md) |
| Z3 | smt-verify（integrated-workflow と reverse-workflow では任意） | `pip install z3-solver` または https://github.com/Z3Prover/z3 |
| sqlite3 または PostgreSQL | generate-db-schema（任意。生成DDLの実行検証用） | macOS は sqlite3 同梱 / https://www.postgresql.org/ |

macOS では `java` コマンドがあっても Java 本体が入っていないことがあります。`java -version` が版を表示することを確認してください。

define-contract、generate-code、generate-db-schema、route-models、extract-spec、refine-spec、reconcile-code、import-natural-spec、export-human-spec、formal-methods-guide は、外部ツールなしで成果物を書くところまで動きます（書かれたコード・DDL・テストを実行するには、上の表のツールか対象プロジェクトのテスト環境が要ります）。reverse-workflow も、フォワード接続をしなければ同じです。フォワード接続をする場合は integrated-workflow と同じツールが要ります。

## リポジトリ構成

| パス | 内容 |
|------|------|
| `skills/` | 15スキルの定義（各スキルは SKILL.md、多くは references/ 付き） |
| `examples/` | 動作例（`task-manager`: VDM-SL仕様 → TypeScript実装 → SMT-LIB確認） |
| `eval/` | 評価フレームワーク（ベンチマーク課題、実行ログ、採点スクリプト、結果） |
| `design/` | 設計文書（`reverse-workflow-design.md` — リバースワークフローの設計時ドキュメント） |
| `docs/` | 記事・発表資料の下書き（`zenn/`、`lt-ai-driven-dev/`）、配信チャネルの台帳（`announce/`）、初回実行の記録（`onboarding-tests/`） |
| `scripts/` | 開発用のスクリプト（ドキュメントの lint、インストール手順の一致検査、例の証跡の再生成、スキル内の VDM-SL の検査） |
| `prompt-templates.md` | ユーザー向けプロンプトテンプレート集 |

## 評価

過去の30成果物と集計を履歴として保存しています。対照群には意図的な欠落の記録があり、旧集計はヒューリスティック採点を含むため、通常開発に対する効果の比較証拠としては扱いません。旧mutation runnerには起動失敗やタイムアウトをkillに数える問題もあり、過去の100%という値を検出性能の根拠には使いません。成果物は欠陥検出用fixtureとして活用します。

修正した評価器の再現手順・判定状態は [eval/README.md](eval/README.md)、過去の数値と限界は [eval/results/report.md](eval/results/report.md) を参照してください。

## 変更履歴

[CHANGELOG.md](CHANGELOG.md) を参照してください。

## 今後の予定

- [ ] 決定的な検証コア（v2.3.0 予定。いずれも未同梱）: VDMJ の1コマンドインストーラ（`scripts/install-vdmj.sh`）、起動ラッパー（`scripts/vdmj`）、環境診断（`scripts/doctor.sh`）、verify-spec の検査手順への QuickCheck の組込み（いまは報告の後の任意の提案だけ）、CI
- [ ] 複数モジュール例（examples/library、v2.3 以降）
- [ ] 評価の再実施（独立した採点者・複数モデルでの追試、変異数を増やしたミューテーションテスト）
- [ ] 実プロジェクトでの適用事例の収集

## 作者

IID Systems (https://iid.systems)

## ライセンス

MIT — [LICENSE](LICENSE) を参照
