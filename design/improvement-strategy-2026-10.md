# formal-agent-contracts 改善戦略（2026-10）

対象: v2.2.0 / 15スキル / 作業ツリー（codex/fix-verification-baseline はコミット0件で HEAD == master 076ab64。実体は未コミット46ファイル＋ iid2 側の未コミット変更）
作成日: 2026-10-08（最終 push 2026-09-16 から22日）

> **作成方法**: 7視点（オンボーディング／アーキテクチャ／コンテンツ品質／証拠／市場／実プロジェクト適用／ロードマップ）の独立監査で83件の指摘を収集し、重複統合後の58件を1件ずつ事実検証と価値判断にかけて36件に絞り込んだ。その36件を根拠に、採用優先・厳密性優先・深さ優先の3戦略を独立に立案し、3名の審査（単独メンテナ／懐疑的な上級エンジニア／形式手法研究者の視点）で採点・統合したうえで、完全性批評と改訂を経たもの。各 finding の証拠全文・提案アクション・却下理由・審査結果は [improvement-strategy-2026-10-findings.md](improvement-strategy-2026-10-findings.md) を参照。
>
> **注意**: 本文中のファイル行番号は 2026-10-08 時点の作業ツリー（branch `codex/fix-verification-baseline`、未コミット46ファイル）または master 076ab64 を参照している。以後の編集でずれるため、行番号ではなく引用文字列で grep すること。

---

## 1. 結論

- 賭けるのは「LLMではなく機械が FAILED と反例を出す瞬間」を、JDKなしの開発者が20分以内に到達でき、かつリポジトリ自身が毎プッシュで再導出できる状態にすること。新スキルは6か月間ゼロ。
- 審査3名の勝者は割れた（戦略0 / 2 / 1）。合計点最高の戦略1「薄い決定的コア＋正直なベースライン」を骨子とし、戦略0から「二層クイックスタートの前倒し・公開のカレンダー期限・First-run 報告導線・90日ゲート」、戦略2から「generate-code v0.5 → 複数モジュール例の依存順序・プロパティテスト前倒し・sdd-bridges 前倒し」を接ぎ木した。
- 最初の一手は2つ同時。(a) 作業ツリー46ファイルをセルフレビューしてコミット・push し、report.md §3/§6.3 と verify-spec FAQ の虚偽を消す。(b) **1日目に**著者機へ Temurin 17 + VDMJ suite + z3 を入れる（P2 はその手順をスクリプト化する週）。後者なしには新しい証拠もGIFもCIも作れない。
- 前提工数: **週5日・1日6時間（30日 ≈ 21実働日、35日 ≈ 25実働日）**。単独メンテナなので P3→P4 は直列。35日で v2.3.0（信頼＋コア＋最初の1時間＋CI）、75日で v2.4.0（パイプライン整合性）、90日目の外部 First-run 報告3件が「続行か配信集中か」の判定点。

## 2. 現状診断

| 観点 | 事実 |
|---|---|
| 採用 | 1 star / 0 issue / 14日で3ユニーク閲覧。クローン約40は catalog の bot 同期。最終push 2026-09-16。Zenn記事（19KB、完成、2026-07-03 追加）は約3か月未公開。dev.to に古い投稿あり（本数・内容はリポジトリ内に記録なし）[market-08] |
| アーキテクチャ | skills のみ。hooks/commands/agents/CI なし。VDMJ の探索順も起動コマンドも未定義で5ファイルで食い違う [onboarding-05+architecture-vdmj-invocation-undefined+content-quality-09]。QuickCheck はどのスキルも実行しない [roadmap-01]。integrated-workflow は generate-tests を呼ばず、Java 不在時の縮退モードもない [architecture-integrated-workflow-never-calls-generate-tests+real-world-test-generation-half-pipeline][onboarding-06] |
| 証拠 | eval の Control 群は意図的欠陥入り（INTENTIONAL_GAPS.md）で report.md 本文は未開示 [evidence-01]。M2 +42.8pp は .vdmsl の存在、M6 はテスト数＋キーワード数 [evidence-04+evidence-06]。作業ツリーに evidence/verification.json（recorded_on 2026-10-04、Java 17.0.16+8 / VDMJ 4.7.0 / Z3 4.15.4、37 PO・unproved 37）と vdmj-po.txt があるが**採取環境が未記録**で、speaker-notes の 2026-07-02 実測（PROVABLE 16 / MAYBE 19 / TIMEOUT 2）とも突合されていない。QuickCheck のクリーン／seeded ログは未コミット [architecture-no-ci-verified-fixtures+roadmap-08+evidence-10]。開示文・evidence/・package.json は下書き済みだが未コミット |
| コンテンツ | verify-spec FAQ が存在しない VDM-SL 規則を教え、自前の例と矛盾 [content-quality-01]。extract-spec の対応表は `old x`/`delete`/後置 if でパース不能、`x~` は未解説 [content-quality-02+content-quality-12]。define-contract:250 と contract-templates.md（20, 63, 176, 247, 308, 669行）に無効構文 `imports all from Prelude`。generate-tests は架空の CI を案内（npm script 非同梱の注記は作業ツリー :834 で済み）[onboarding-11+content-quality-03+real-world-ci-recipe-is-fictional]。バージョン表記が15通り、タグ・CHANGELOG なし [onboarding-12+content-quality-05+market-11] |
| 市場 | 「agent contracts」は別概念に奪われ、catalog 説明は v1 時代 [market-06][onboarding-09+market-01+content-quality-08]。Spec Kit / cc-sdd への橋が文書化されていない [market-04]。VDM×エージェントの公開ツールは唯一だが上流 VDMJ は31 star [market-05]。デモ媒体ゼロ [market-07] |

## 3. 戦略の骨子

**テーゼ**: 差別化は「機械の判定」だけ。現状それは到達不能（手動zip、起動手順未定義）、未実行（QC をどのスキルも呼ばない）、未証明（CI なし、eval は細工済み、既存 evidence は出所未記録）。6か月は新機能ではなく、この3点の修復と、疑い深い読者が最初に開く面（eval/、FAQ、例、catalog、dev.to）を正直にすることに使う。

**想定ユーザー**: Claude Code で Spec Kit / cc-sdd / OpenSpec 流に仕様先行している日本語圏の TypeScript 開発者（1〜5人チーム）。Node はあるが JDK はない。Zenn を読み、Claude Code Meetup Japan / AI駆動開発勉強会に来る。10分で「何か動く」を、1週間で「.vdmsl の変更で CI が赤くなる」を判断基準にする。副次（信頼のため）: eval/ を開く Overture/VDM コミュニティと上級エンジニア。

**やらないこと**
- 新スキルディレクトリ（design-system を含む。README ロードマップ行と generate-db-schema:158 の先行参照は P1 で削除）[roadmap-04+roadmap-11]
- Playwright / E2E / traces（trace を出すスキルがない）
- route-models の実行機構（agents/、route-score、トークン計測）[architecture-route-models-has-no-runtime-mechanism+roadmap-03]
- eval 再実施（独立採点・複数モデル・>200 mutant）は property test とユーザー要求が揃うまで。それまで eval/ は「歴史的アーカイブ、説得には使わない」
- フレームワークアダプタ（zod/NestJS/pydantic/Prisma）は90日後のフィードバックから最大1件 [real-world-no-framework-adapters]
- Homebrew tap、MCP サーバ、Overture 論文（論文は eval 再実施待ち）[market-05]
- リポジトリ改名、README.en.md、ナレーション付き動画、FAC_STRICT 等の環境変数、VDMJ 出力の JSON パース
- hooks は P6 の fail-open 版のみ。hooks は Claude Code 専用であり、「skills-only で他ハーネスへ移植可能」の訴求（P5）には含めない

## 4. 優先施策

### P1. 正直なベースラインを master に載せる（1〜7日）
目的: 疑い深い読者が1分で見つける虚偽をゼロにし、以後の全公開物の土台を作る。
根拠: [evidence-01][evidence-04+evidence-06][evidence-11][content-quality-01][content-quality-02+content-quality-12][onboarding-12+content-quality-05+market-11][onboarding-09+market-01+content-quality-08][roadmap-04+roadmap-11]
- **1日目**: 著者機に `brew install --cask temurin@17`、vdmj-suite 4.7.0 zip を ~/.vdmj へ、z3。実行したコマンドをそのままメモし P2 の install-vdmj.sh の素材にする
- **作業ツリーをセルフレビューしてコミット・push**（ブランチにコミットはない）: eval/README.md、examples/task-manager/{README.md,evidence/,run-tests.cjs}、package.json、verification-results.md、smt-verify の `command -v z3` 修正を含む。先に `.gitignore` に `.claude/` を追加（現行の `launch.json` / `settings.local.json` 行では `?? .claude/` が消えていない）。iid2 側の未コミット5ファイル（configuration/evaluation/examples ページ、en.json、ja.json）も同時にコミット・デプロイ
- **evidence の出所を記録**: verification.json に `environment`（ホスト名/サンドボックスの別、OS、実行日、コマンド）を追記する。記録できない場合は P2 の再生成まで README/Zenn/slides から「37 PO」を引用しない。speaker-notes の 2026-07-02 実測との差は「VDMJ 版・実行環境が異なる別計測」と注記
- eval/results/report.md: 冒頭に「Known confound」バナー、§3 の「自然と検出される」「見落とす傾向」（~59, 70行）を削除、§6.3（~140行）を「M2 は .vdmsl の存在、M6 はテスト数＋キーワード」に書換え。mutation-report.md ~141行を「結論不能（ランナー欠陥、コンパイルエラーを kill 扱い）」に改題
- slides.md 付録（~234-235行）と iid2 m2Delta/m6Delta の +42.8pp/+20.3pp を削除（ja.json は hedged 文言下書き済みだが m2Delta '+42.8pp' が残る）、h2Desc/h3Desc/conclusion1 を en/ja 揃えてコミット・デプロイ
- skills/verify-spec/SKILL.md: 「Record type used in set」FAQ を削除し `set of <Record>` は有効（TaskManager.vdmsl:44）と注記。`inv msg_inv(...)` 単独例と「PO が多い→事前条件を強化」も同時修正。:635 の「スキル設定で vdmj パスを指定」は1行削除（本格書換えは P2）
- 構文掃除: skills/extract-spec/references/code-to-vdmsl-mapping.md を VDMJ でパースする構文に書換え（`users~`、`{id} <-: users`、前置 if、`state ... of ... end`）。formal-methods-guide/references/vdm-sl-syntax.md に `x~` 節を追加。generate-tests:743 を `RESULT`/事後条件に。後提条件→事後条件を reconcile-code と diff-analysis-rules.md まで一掃。**`imports all from Prelude` を define-contract/SKILL.md:250 と contract-templates.md の全6箇所から削除**
- lint の前提となる1行修正を同週に: slides.md:213 / speaker-notes.md:85 の 13→15、docs/zenn:104 の「PROVABLE 16 / MAYBE 19 / TIMEOUT 2」を evidence/ へのリンク（出所記録済みの場合）か削除に置換
- `npm run lint:docs`（grep のみ、Java 不要）を `npm test` に組込み。**対象は skills/ README.md docs/**、`scripts/` は除外。パターン: `\bold [a-z]`、`post .*\bresult\b`、後提条件、Record type used in set、imports all from Prelude、`vdmj-4\.7\.0\.jar`、スキル設定、13スキル、自然と検出される、コードの振る舞いで評価、+42.8pp、PROVABLE 16。**allow-list** `eval/lint-docs.allow`（`path:line` 形式）に vdmj-setup.md:44（Maven URL）を P2 書換えまで登録。README/slides のスキル数 = `ls skills | wc -l` も検査
- README §今後の予定（:127）の design-system 行と generate-db-schema/SKILL.md:158 の先行参照を削除
- 各 SKILL.md の日付/版フッタと「新機能 v2.0.0」バッジを削除。README の変更履歴を CHANGELOG.md へ（plugin 版→skill 版の対応、各リリースで触った iid2 辞書キーを列挙）。v0.1.0〜v2.2.0 の注釈付きタグと v2.2.0 Release
- 外部待ちを先に出す: dev.to の投稿を著者が一覧し、本数・URL・修正点（スキル数、インストール経路、VDMJ 版、eval 記事への編集注）を docs/announce/CHANNELS.md に記録してから修正する。claude-plugins-community へ説明文 PR
工数: S〜M（4〜7日） / 成功指標: lint:docs が master で緑（allow-list は vdmj-setup.md:44 の1件のみ）、`grep -rn 'Record type used in set\|old users\|後提条件\|imports all from Prelude' skills/` が0件、`git tag` に v2.2.0、iid2 本番に hedged 文言かつ +42.8pp なし、CHANNELS.md に dev.to の記録、verification.json に `environment` あり。

### P2. 決定的な検証コア（8〜21日）
目的: VDMJ/Z3 実行を Claude の即興から1本のスクリプトへ移し、QuickCheck を検証フローに入れ、Java 不在でも止まらなくする。
根拠: [onboarding-05+architecture-vdmj-invocation-undefined+content-quality-09][onboarding-04+real-world-tool-bootstrap-not-reproducible+market-12][onboarding-06][roadmap-01][market-07][evidence-03]
- `scripts/install-vdmj.sh`: 固定 URL + SHA-256、~/.vdmj へ展開、必ず確認してから実行。**JDK はユーザーローカル（Temurin tarball → ~/.vdmj/jdk）を既定**にし、cask はオプション扱い。これで新規アカウント／コンテナでの検証が成立する
- `scripts/vdmj`（POSIX sh）: 解決順 `$VDMJ_JAR` → PATH の `vdmj.sh` → `~/.vdmj/vdmj.sh` → `~/.vdmj/vdmj.jar`（iid2 設定ページが既に案内する場所） → `./vdmj*.jar`。Java も `$JAVA_HOME` → `~/.vdmj/jdk` → PATH の順。サブコマンド `check|po|qc`、ディレクトリ/glob 可、終了コード 0/1/2、`VDMJ_VERSION` はここだけに固定。Maven jar のみの場合は「qc には suite zip が必要」と明示。テキスト透過＋1行サマリまで、JSON は後回し
- `scripts/doctor.sh`: `which java` ではなく `java -version` を実行（macOS スタブ対策）、VDMJ 解決、z3、node ≥22、sqlite3。スキル別の利用可否マトリクスとインストール一行コマンド、`--brief`
- **検証環境を定義**: `docs/onboarding-tests/` に (a) `node:22-bookworm-slim` コンテナ（Java なし、縮退モード確認用）、(b) `ubuntu:24.04` コンテナ（クリーンインストール計時用）、(c) 著者 Mac の新規ユーザーアカウント（JDK がユーザーローカルなので Java なしから開始できる）を記載。計時はこの3環境で著者が行う
- skills/verify-spec/references/vdmj-invocation.md を唯一の正典とし、verify-spec Step 0（doctor）/2-3/7、smt-verify、integrated-workflow Phase 0/2、reverse-workflow から参照。ハードコード jar 名を削除し vdmj-setup.md:44 を書換え（allow-list から除去）。vdmj-setup.md は README:75 からのみリンクされ、スキルからは参照されていないので verify-spec から参照。iid2 設定ページに探索順を反映
- verify-spec と integrated-workflow Phase 2 に「Step 7.5: QuickCheck」。`scripts/vdmj qc` を実行し PO ごとに PROVABLE/MAYBE/FAILED/TIMEOUT を verification-results.md の status に写像。FAILED は反例を自然言語で説明し status failed。QC は smt-verify の PO 優先順位付けにのみ使い、PO を除外しない。vdmj-setup.md:117 の「Provable = 反例なし」は VDMJ 自身の定義を引用して訂正し、verification-results.md に QC 判定語の写像表を追加、PO ごとの strategy 名を evidence に残す
- 縮退モード: Phase 0 で Java/VDMJ を Z3 と同様に探り、1回だけ「未検証で続行するか」を質問。Phase 2 を `not-run`、Step 6 を「文書レビュー」と表示、UNVERIFIED バナーを session-report-template.md と workflow-phases.md の遷移表に伝搬
- `examples/task-manager/seed-bug.patch`（0045ff1 以前の off-by-one を再現）、evidence/vdmj-qc.txt（クリーン）と vdmj-qc-seeded.txt をコマンド・日付・VDMJ 版・環境付きで再生成しコミット。seeded の PO 数・FAILED 数は**再計測して記録**する（0045ff1 コミットメッセージの「38 PO / 2 FAILED」と speaker-notes の「PO #21 単独」は別変種で、どちらも転記しない）。verification.json はこの時点で再生成し P1 の暫定出所記録を置換
工数: M（1.5〜2週） / 成功指標: (b) と (c) で install → doctor → `scripts/vdmj qc` が20分以内に FAILED 0、seed-bug 適用で FAILED PO と反例。`grep -rn 'java -jar' skills/` が vdmj-invocation.md のみ。(a) で integrated-workflow が UNVERIFIED バナー付きで Phase 5 に到達。

### P3. 最初の1時間を2回成功させる（22〜27日）
目的: 14日で3人の訪問者を README の2つ目のプロンプトで失わない。
根拠: [onboarding-02+onboarding-10][onboarding-03+real-world-flagship-example-violates-own-process][onboarding-11+content-quality-03+real-world-ci-recipe-is-fictional][market-06]
- README 使い方 → クイックスタート二層。(1)「10分で試す（Javaなし）」: task-manager の3項目プロンプト →「TypeScriptコードを生成して」→「契約テストを生成して」→ `npm run test:example`。define-contract が返す質問と要約した応答を載せ、「LLMが書いた契約とテストであり機械検証ではない」と明記。(2)「フル検証（20分、install-vdmj.sh 1本）」: PO 数 / FAILED 0 と seed-bug 反例を evidence/ へのリンクで示す（数値はインライン転記しない）
- 3つのスキル表に requires 列（none / Node / Java+VDMJ / Z3 / sqlite）。examples/task-manager/README.md に日本語節（生成コマンド・実行コマンド・evidence の読み方）を追加。generate-code Step 7（~154-158行）の `generated/` 規則は例が既に満たしているため、残るレイアウト差分は P6 の `.generated.ts` / `.impl.ts` 分割で解消すると注記
- 正規インストールブロックを1つ（community 経路を先、repo 経路を「最新」＋遅延注記、動作確認した Claude Code 版）。Zenn・slides・FB草稿・iid2 に逐語コピー。「インストール確認」プロンプトを追加。`scripts/lint-install-block.mjs` で README のブロックを抽出し、iid2 en.json/ja.json（JSON.parse 後）、Zenn、slides の該当部分と**空白正規化後の diff**で比較（iid2 は JSON エスケープ保存のためバイト一致は要求しない）
- 冒頭文・plugin.json・marketplace.json・GitHub 説明・iid2 を統一タグラインに: 「仕様駆動開発のための機械検証つき仕様（Spec Kit / OpenSpec / cc-sdd を補完）: VDMJ+QuickCheck で型検査・反例候補をコード前に、ランタイム契約と契約テストを生成」。「works with」は使わない。keywords に spec-driven-development, spec-kit, openspec, quickcheck, counterexample, design-by-contract
- generate-tests: Step 0 で package.json/vitest/jest 設定を検出、無ければ opt-in で最小 package.json か `node --test` 形式を提案、フェーズ報告に実行コマンドを必ず印字。generate-code にも同じ「実行方法」フッタ。架空の CI スニペット（~759-793行）と `npm run test:full`（~806行）を削除し P4 の ci-recipes.md を参照（npm script 非同梱の注記は :834 に既にあるので重複させない）
- generate-db-schema/route-models を slides の前方チェーンに 3.5/3.6 として挿入。CONTRIBUTING.md に「既存スキルに CI 検査付き実行例が揃うまで新スキルなし」「eval/ は歴史的アーカイブ、説得に使わない」を明記
工数: S（3〜5日） / 成功指標: 著者が P2 環境 (a) で README だけを見て15分以内に緑のテストへ（タイムスタンプ付き記録を docs/onboarding-tests/ に保存。外部テスターは P5 の First-run 報告で代替し、指標には含めない）。`lint-install-block.mjs` が README/Zenn/slides/iid2 で差分0。

### P4. リポジトリが自分の主張を機械検証する（28〜35日）
目的: 「PO 数 / FAILED 0」を著者機ではなく GitHub runner が再導出する。
根拠: [architecture-no-ci-verified-fixtures+roadmap-08+evidence-10][evidence-03][market-07][onboarding-11+content-quality-03+real-world-ci-recipe-is-fictional]
- `.github/workflows/verify.yml`: setup-java temurin 17、install-vdmj.sh でキャッシュ、`pip install z3-solver`、Node 22。厳密アサートは「型エラー 0・Generated N proof obligations（N は evidence/verification.json の po_count を読む）・QuickCheck FAILED 0・**examples の全テスト通過**（件数は evidence/implementation-tests.txt から読み、ハードコードしない）・sqlite3 :memory: に DDL 投入」のみ。PROVABLE/MAYBE/TIMEOUT の内訳は evidence/ に記録するだけで CI ゲートにしない。z3 は examples と skills/smt-verify/references/test-po*.smt2 を `-T:30` 付きで実行し、ヘッダコメントが宣言する期待結果（unsat）をアサート（現時点ではこの環境で未確認、CI 初回実行で確定）。サマリ行に「PO 対応は未検証（source_correspondence: unverified）」を必ず載せる。suite zip 取得失敗時は Maven jar へ縮退し qc 不可を警告
- 非ゲートの reality-check ジョブ: eval/runs/treatment/**/*.vdmsl を `scripts/vdmj check` し「15本中 N 本が型検査通過」を eval/README.md に記録
- seed-bug.patch を適用した PR で CI が赤くなること（P2 で再計測した PO 数・FAILED 数）を一度確認
- README に CI バッジ。タグは緑コミットからのみ。**v2.3.0 をここで打つ**
- 35日以降（P5 前半に移動）: `docs/demo/demo.tape`（VHS、約25秒、qc → FAILED 0 / patch → FAILED＋反例）を demo.gif に描画し README 冒頭・iid2・Zenn に掲載。verify.yml のユーザー向け半分を skills/verify-spec/references/ci-recipes.md に抽出。`.devcontainer/` は install-vdmj.sh を再利用する形でのみ追加（2本目のインストール経路にしない）
工数: M（約1週、GIF/ci-recipes/devcontainer を除く） / 成功指標: master でバッジ緑、CI ログに「Generated N proof obligations」「FAILED 0」。seed-bug PR が赤。evidence/ にクリーン・seeded の両 QC ログ。v2.3.0 タグ。

### P5. 公開と導線（36〜60日）
目的: 完成資産を正直になった順に出し、最初のフィードバックが届く導線を作る。
根拠: [market-08][market-04][market-09][market-10][market-05][market-06]
- 36〜45日: demo.gif、ci-recipes.md、devcontainer（P4 から移動）。Zenn 公開ゲート: confound バナーが master にある・demo.gif がコミット済み・verify.yml 緑。3条件が揃い次第 `published: true`。揃わなくても45日目には公開（Node-only 層を CTA に）。未公開の1週は流入ゼロ
- 公開前に CTA を二層（「10分: 契約+テスト」「20分: 反例まで、install-vdmj.sh 1本」）に、「VDM×エージェント唯一」の主張に「2026年10月時点の調査」を付記、数値は evidence/ へリンク
- skills/import-natural-spec/references/sdd-bridges.md を Zenn 公開前に追加: Spec Kit specs/<feature>/spec.md、OpenSpec openspec/specs/**、cc-sdd .kiro/specs/<feature>/requirements.md、EARS WHEN/SHALL → pre/post、FR-ID → [REQ-nnn]、実例1本。書き戻し機能は作らない。README 第1段落で「補完する」と言及
- 翌週: Zenn を英訳し、CHANNELS.md に記録した dev.to 投稿を上書き編集（URL 維持）。README に Media 節。FB 案B は最後
- 既存5分デッキで次回 AI駆動開発勉強会 / Claude Code Meetup Japan の LT に応募（S6 を GIF で裏付け）。四半期1 LT、マイナー版ごとに Zenn 1本（v2.4 = 約束済みの DBスキーマ導出）。docs/announce/CHANNELS.md に記録
- GitHub Discussions を有効化、「First-run report」issue テンプレート（OS / Node / Java / doctor.sh 出力 / 詰まった場所）
- `scripts/install-skills.sh`（Codex は .agents/skills または ~/.codex/skills、他は公式ドキュメントで確認してから）。README のマトリクスは未検証ツールを「untested」、route-models は「Claude Code 外では縮退」、hooks は「Claude Code 専用」と明記。外部キュレーションリストへの申請は、公開前に実在と受付条件を確認したものに限る
- Overture/VDMJ メンテナに例・evidence・記事を送るだけ（論文は出さない）
工数: S（公開）+ M（6か月のケイデンス） / 成功指標: Zenn が45日目までに公開、初月 500 view。catalog PR マージ。dev.to 修正済み。demo.gif が3面に掲載。90日目までに LT 1回、外部アカウントからの First-run 報告または issue 3件以上。

### P6. パイプライン整合性 v2.4（46〜75日）
目的: 仕様変更の2回目以降も .vdmsl が正本であり続け、生成テストが CI で drift を拾う。
根拠: [roadmap-06][real-world-generated-code-cannot-be-regenerated][architecture-integrated-workflow-never-calls-generate-tests+real-world-test-generation-half-pipeline][roadmap-07][architecture-trigger-phrase-collisions+content-quality-10][architecture-route-models-has-no-runtime-mechanism+roadmap-03][architecture-no-hooks-no-enforcement][real-world-drift-detection-is-manual-and-full-scan]
内部順序は固定（戦略2の依存洞察）:
1. generate-code v0.5: `x~` 規則（プリミティブはスナップショット、map/record は structuredClone）、`set of <Record>` の等値戦略（キー Map か正準文字列 Set）、有界 `exists`/内包 → `dom` ループ、全操作後の状態不変条件検査。出力を `<module>.generated.ts`（常に再生成）と `<module>.impl.ts`（初回のみ、TODO はここ）に分割。`// @generated from <spec> sha256:<hash> by formal-agent-contracts vX.Y.Z` ヘッダ、ハッシュ不一致なら上書き拒否して diff 提示。`npm run lint:generated` で examples のヘッダハッシュ = 現仕様ハッシュを CI 検査。task-manager を v0.5 で再生成し integrated-workflow を一周してから v2.4.0 を打つ（テスト件数が変わるため P4 のゲートは件数非依存のまま）
2. integrated-workflow Phase 5 → 5a（スモーク、フォールバック）+ 5b（generate-tests を spec + PROTOCOL.md/API-SIGNATURES.md で起動、プロジェクトのランナーを実行、節→テスト対応表を引継ぎ条件に）。スキルマップ（~L348-357）と report テンプレートに generate-tests を追加、description を本文に合わせる
3. generate-tests: 実際の生成レイアウトと vitest/jest 設定から import を解決。「Strategy F: プロパティテスト」（fast-check: pre を満たす任意入力 → post と inv 成立）、QuickCheck の FAILED 反例を固定回帰ベクタとして再利用。Python は4か月目に pytest-templates.md（hypothesis）を出すか README/plugin.json から「Python」を外すか決める
4. トリガー衛生: 先に eval/triggers.jsonl（15スキル×5言い回し = 75件、各行 `{prompt, expected_skill}`）を作り、skill-creator スキルの trigger eval で「期待スキルが選ばれた件数」を計測（合格 = 75件中 ≥68件、書換え前後で比較）。その後 description を相互排他に（reverse-workflow が「リバースエンジニアリング」を所有、extract-spec は「仮仕様を抽出（単段）」のみ、reconcile-code から「auto-generate tests」を削除、「仕様を確認して」= refine / 「仕様を検証して」= verify、integrated-workflow の「multiple phases in sequence」を削除）。各 ≤400 バイト。README に `/formal-agent-contracts:<skill>` の明示起動を先に記載。iid2 と catalog PR に同期
5. route-models: README/plugin.json で「experimental」、表の末尾へ、plugin.json / marketplace.json の keywords から「token-optimization」を削除、「モジュールの generate-tests はコード生成に使った tier より下げない」と明記、以後凍結
6. 軽い強制: define-contract ステップ4 の直後に必須検証ステップ（`scripts/vdmj check` か `not-run` 記録）、generate-code は検証証跡がなければ全ファイルに UNVERIFIED スタンプ。`hooks/hooks.json` は fail-open の PostToolUse（`\.vdmsl$` → `scripts/vdmj check`）と SessionStart（`doctor.sh --brief`）のみ。Claude Code 専用で suite 未導入機では no-op になるので「強制」とは宣伝しない。補償統制は UNVERIFIED スタンプと doctor 出力
7. reconcile-code: 架空の「plugin.json integration point」を削除、`git diff --name-only <base>` と @generated ハッシュで対象を絞る Step 0 を追加。Zenn の「うるさく腐る」文を「仕様ハッシュで陳腐化を検出するが、手書きコードの意味的 drift は検出しない」と書き換え
工数: M〜L（3〜4週） / 成功指標: prompt-templates.md テンプレート3 を task-manager に流すと、実装を import する generate-tests スイートと操作ごとのプロパティが生成され CI 緑。仕様1行変更後の再生成で impl.ts が無傷。task-manager.ts の atomic 更新を落とした seeded バグをプロパティテストが CI で検出。triggers.jsonl ≥68/75、description 合計 ≤6KB。v2.4.0 を75日目までに。

### P7. 条件付き: 複数モジュール例と深さ優先ルール（90〜120日、90日ゲート通過時）
根拠: [roadmap-09][real-world-no-scale-strategy][real-world-no-framework-adapters][roadmap-12]
- eval/tasks/task2-library/gold-spec.vdmsl（5モジュール、imports/exports 有）を examples/library/ にコピー（移動しない）。PROTOCOL.md、API-SIGNATURES.md、v0.5 レイアウトの生成コード、契約＋プロパティテスト、DB スキーマ、model-routing.json（推奨のみ）、evidence/。verify.yml に同じ件数非依存ゲートで接続
- First-run 報告3〜5件から zod アダプタ / 増分 drift / extract-spec の bounded-context 分割のうち1つだけ選ぶ。要求前には作らない。refine-state.json 等のセッション永続化は見送り
工数: M（2〜3週、条件付き） / 成功指標: examples/library が task-manager と同じ CI ゲートを通過、route-models が2モジュール以上で異なる tier を出す。120日目までに少なくとも1つのロードマップ判断が引用付きの外部 issue に基づく。

## 5. 実行順序

前提: 週5日・1日6時間の単独作業。P1〜P4 の見積合計は 19.5〜27実働日で、35日ブロック（≈25実働日）に収める。

| 期間 | 内容 | 出荷 |
|---|---|---|
| 1〜7日 | 1日目に Temurin/VDMJ/z3 を著者機へ。P1 全部（コミット・push、iid2 デプロイ、evidence 出所、lint:docs + allow-list、design-system 行削除、13→15、dev.to 記録と修正、catalog PR） | master が正直になる |
| 8〜21日 | P2: install-vdmj（JDK ユーザーローカル）・scripts/vdmj・doctor、検証環境3種、vdmj-invocation.md、QC Step 7.5、縮退モード、seed-bug.patch と QC ログ再計測 | |
| 22〜27日 | P3: 二層クイックスタート、requires 列、タグライン統一、インストールブロック diff スクリプト、generate-tests Step 0、CONTRIBUTING | |
| 28〜35日 | P4: verify.yml（件数非依存ゲート、`-T:30`）、reality-check、seed-bug PR が赤、バッジ | **v2.3.0** |
| 36〜45日 | P5 前半: demo.gif、ci-recipes.md、devcontainer、sdd-bridges.md → Zenn 公開（3ゲート、45日目が上限）、Discussions と First-run テンプレート | |
| 46〜60日 | P5 後半: dev.to 英訳、LT 応募、install-skills.sh | |
| 46〜75日 | P6 を固定順序で。task-manager を v0.5 で再生成し一周 | **v2.4.0** |
| 76〜90日 | LT 実施、First-run 報告を全部読む。**90日ゲート**: 外部報告 ≥3 で P7 へ、未満なら残りは配信実験（追加 LT、英語記事、Overture 連絡）に充て機能は作らない | |
| 91〜180日 | P7（条件付き）、v2.4 の Zenn 記事（DBスキーマ導出）、2回目の LT、Python 判断 | v2.5.0（条件付き） |

最小出荷フォールバック: 35日ブロックが滑った場合でも v2.3.0 = 「正直なベースライン（P1）+ scripts/vdmj + vdmj-invocation.md + 二層クイックスタート + verify.yml の厳密ゲート」で切る（これが §1 の賭けの最小形）。先に落とすのは doctor のマトリクス、reality-check ジョブ、seed-bug PR 確認、demo.gif、ci-recipes.md、devcontainer。Zenn は45日目に Node-only 層を CTA にして出す。P6 内で削るなら、trigger 衛生と reconcile Step 0 を先に落とし、CI と正直なベースラインは落とさない。

## 6. リスクと対処

| リスク | 対処 |
|---|---|
| 単独メンテナの時間不足（P1〜P6 で実働8〜9週、前提は週30時間） | 上記フォールバックを事前に宣言。公開はカレンダー期限（45日）で止めない。P3/P4 は直列、GIF/devcontainer は v2.3.0 の後 |
| 著者機の Java が検証環境を汚す（cask は /Library/Java に入る） | install-vdmj.sh の既定を ~/.vdmj/jdk（ユーザーローカル）にし、計時と縮退確認はコンテナ2種＋新規 macOS アカウントで行う |
| JDK が壁のまま（インストール拒否ユーザー） | Node-only 10分層を「機械検証ではない」と正直にラベルし、Codespaces は CI 後に install-vdmj.sh 再利用で提供 |
| QuickCheck 内訳が VDMJ 版・実行機で揺れる | CI 厳密アサートは PO 数（evidence から読む）と FAILED 0 のみ、内訳は情報扱い。VDMJ_VERSION を1箇所固定、更新は新 evidence ファイルを伴う意図的変更 |
| 既存 evidence の出所が不明なまま引用される | P1 で `environment` 追記、できなければ P2 再生成まで引用禁止（lint:docs の `PROVABLE 16` パターンで転記を検出） |
| suite zip の URL/タグが変わる、上流 VDMJ が止まる（31 star、単独メンテナ） | URL + SHA-256 固定、Actions キャッシュ、zip を本リポジトリの Release asset にミラー。失敗時は Maven jar で check/po のみに縮退し警告 |
| 正直化で見栄えが落ちる（+42.8pp を失う、QC は「all Unproved」） | 受け入れる。GIF と seeded 反例がピッチを担う。バッジ行は「z3: 翻訳式 unsat、PO 対応未検証」まで書き、新たな過大主張を作らない |
| hooks は Claude Code 専用かつ suite 未導入機で no-op | 強制とは宣伝せず、UNVERIFIED スタンプ + doctor を補償統制として文書化。移植性の訴求は skills のみに限定 |
| description 書換えで自動起動が退行 | triggers.jsonl を書換え前に作って skill-creator の trigger eval で前後比較、明示起動を README に先に記載 |
| iid2 の en/ja 同期漏れ | iid2 側に `npm run lint:dict`（en.json/ja.json のキー集合一致）を追加しデプロイ前に実行。CHANGELOG の各リリースに触った辞書キーを列挙、リリース単位で1回デプロイ |
| catalog PR / dev.to 編集が第三者待ち | README は repo 経路も残す。GitHub 説明と README が主検索面 |
| 想定ユーザーが仕様を書きたくない可能性 | 90日ゲート（外部報告3件）が kill-or-continue。未達なら機能でなく配信に時間を回す |

## 7. 却下した提案とその理由

| finding | 理由 |
|---|---|
| onboarding-01+market-02（英語 README、11スキルに英語トリガー追加） | fact-check で否定。15スキル全てに英語トリガーあり。README.en.md は iid2 で代替し作らない |
| onboarding-07（インタビューが README の3項目例と矛盾） | README 自身が「対話的に深掘り」と明記。4〜5ターンの数字は未計測 |
| onboarding-08（15スキルの「どれを使う」表、7 vs 5 テンプレート不一致） | 日本語優先の4スキルにも English triggers あり。iid2 はテンプレートを「5件しか載せていない」だけで不一致ではない。4行表は好機があれば追加 |
| architecture-po-to-smt-conversion-is-prose+roadmap-02（po2smt.ts） | 価値判断で落ちた。VDM 式パーサは L 以上で、対象の機械的 PO 群は QuickCheck が既に処理。`-T:30` と unsat フィクスチャの S 部分は P4 の verify.yml に同梱（本文に明記） |
| architecture-context-cost（SKILL.md ≤150行を CI 強制） | 64k は同時には載らない。退行検知なしに10スキルを書き直すコストに見合わない |
| architecture-duplicate-test-generation-libraries / architecture-orchestrator-duplication（統合リファクタ） | 範囲が異なる（既存コード任意言語 vs 仕様先行 TS）。L 規模で回帰検知手段がない。相互参照と命名統一の S 版のみ機会があれば |
| architecture-no-isolated-verifier（読取専用 verifier agent） | 読取専用でも著者コンテキストが仕様やテストを弱めてから再検証できる。working tree の verification-results.md が証跡の正直さを既に担保。「弱体化禁止 + diff 承認」ルールの S 版のみ検討 |
| architecture-no-slash-commands（commands/ 追加、orchestrator の model 起動無効化） | skills は既に `/formal-agent-contracts:<skill>` で起動可能。orchestrator の自然言語トリガーを消すのは損失 |
| evidence-02+09 / evidence-05 / evidence-08 / evidence-12（ハーネス再構築、LLM judge、統計、事前登録） | Control 群が細工済みで、どう再採点しても因果証拠にならない。eval/ はアーカイブ扱いに統一し、再実施はプロパティテストと外部需要の後 |
| evidence-07（StrykerJS 移行） | 作業ツリーの AST ランナーが既に修正済み。コミットが残作業 |
| real-world-single-file-spec-assumption（複数ファイル対応 L） | 見出しが誤り（task2-library は5モジュールで VDMJ はファイル内複数モジュールを扱える）。verifier 指摘の `imports all from Prelude` が無効構文である点は P1 の構文掃除と lint パターンに同梱済み |
| real-world-no-spec-versioning（diff-spec 機能） | L 規模で実際の改版履歴を持つユーザーがいない。@generated ハッシュで provenance のみ P6 に吸収 |
| roadmap-05 / roadmap-10（traces・アニメーション） | QuickCheck と既存の状態遷移テストで大半をカバー。暗黙定義仕様には動かず、VDMJ 導入者にしか効かない |
| market-03（ポジショニング文の書き直し） | 資産は既に日本語 SDD ユーザー向け。問題は未公開であること（P5 で対処） |

## 8. 付録: 確認済み finding 一覧

| id | タイトル（要約） | 工数 | 施策 |
|---|---|---|---|
| evidence-01 | Control 群の意図的欠陥が report.md 本文で未開示 | S | P1 |
| evidence-04+evidence-06 | M2/M6 は構造的アーティファクトだが大効果として報告 | S | P1 |
| evidence-11 | 因果を断定する文と iid2 の反復 | S | P1 |
| evidence-03 | Treatment 群が検証層を一度も実行していない | M | P2/P4（reality-check のみ） |
| content-quality-01 | verify-spec FAQ の偽 VDM-SL 規則 | S | P1 |
| content-quality-02+content-quality-12 | パース不能な VDM-SL 例、`x~` 未解説、後提条件、`imports all from Prelude` | S | P1 |
| onboarding-12+content-quality-05+market-11 | 版・日付の不整合、タグ・CHANGELOG・CI バッジなし | S | P1/P4 |
| onboarding-09+market-01+content-quality-08 | インストール経路の不一致、catalog 説明が v1、13スキル表記 | S | P1（13→15、catalog PR）/P3（統一ブロック） |
| onboarding-05+architecture-vdmj-invocation-undefined+content-quality-09 | VDMJ の探索・起動が未定義、存在しない「スキル設定」 | M | P1（1行削除）/P2 |
| onboarding-04+real-world-tool-bootstrap-not-reproducible+market-12 | doctor/install スクリプトなし、macOS Java スタブ | M | P2 |
| onboarding-06 | integrated-workflow に VDMJ 不在の縮退モードなし | S | P2 |
| roadmap-01 | QuickCheck をどのスキルも実行しない | S | P2 |
| market-07 | デモ媒体ゼロ、反例は slide テキストのみ | S | P2/P5（GIF） |
| onboarding-02+onboarding-10 | クイックスタートなし、2つ目のプロンプトで Java | S | P3 |
| onboarding-03+real-world-flagship-example-violates-own-process | 例に README/package.json なし、レイアウトがスキルと矛盾（作業ツリーで大半修正済） | S | P1/P3（残差は P6 の分割で解消） |
| onboarding-11+content-quality-03+real-world-ci-recipe-is-fictional | 存在しない npm script と架空 CI（script 非同梱注記は :834 で済） | M | P3/P4/P5（ci-recipes） |
| market-06 | 名前衝突と検索語不在の説明文 | S | P3 |
| architecture-no-ci-verified-fixtures+roadmap-08+evidence-10 | CI なし、37 PO の根拠ログ未コミット・出所未記録 | S | P1（出所）/P2（再生成）/P4 |
| market-08 | Zenn 未公開、dev.to の古い投稿 | S | P1（記録・修正）/P5 |
| market-04 | Spec Kit / cc-sdd への橋が未文書化 | S | P5 |
| market-09 | 効く経路は Zenn / Meetup LT / Overture | M | P5 |
| market-10 | skills-only は他ハーネスへ移植可能（hooks は除く） | S | P5 |
| market-05 | VDM の堀は脆い、上流31 star、tap なし | M | P5（連絡のみ）/ 却下（tap・論文） |
| roadmap-06 | generate-code v0.4 が最弱リンク | S | P6 |
| real-world-generated-code-cannot-be-regenerated | TODO が生成物内、再生成は盲目的上書き | M | P6 |
| architecture-integrated-workflow-never-calls-generate-tests+real-world-test-generation-half-pipeline | Phase 5 がスモークのみ、import 経路未解決、Python テストなし | M | P6 |
| roadmap-07 | プロパティテスト不在 | M | P6 |
| architecture-trigger-phrase-collisions+content-quality-10 | description の衝突、10KB 常時注入 | M | P6 |
| architecture-route-models-has-no-runtime-mechanism+roadmap-03 | 監査不能な routing、循環ゲート、keywords の token-optimization | S | P6 |
| architecture-no-hooks-no-enforcement | hooks なし、define-contract が検証せず終了 | M | P6（fail-open 版のみ、Claude Code 専用） |
| real-world-drift-detection-is-manual-and-full-scan | 増分 drift 検出なし、架空の integration point | S | P6（S 部分のみ） |
| roadmap-09 | 複数モジュール例が repo 内にない | M | P7 |
| roadmap-04+roadmap-11 | 深さ優先、design-system 削除 | S | P1（README:127 / generate-db-schema:158 削除）/P3（CONTRIBUTING ルール） |
| real-world-no-scale-strategy | 300行超の戦略なし | M | P7（bounded-context のみ、条件付き） |
| real-world-no-framework-adapters | zod/NestJS/pydantic/Prisma 非対応 | M | P7（1件のみ、要求後） |
| roadmap-12 | 統合ロードマップ案 | L | 本文書が置換 |