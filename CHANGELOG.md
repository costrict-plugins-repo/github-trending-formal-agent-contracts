# Changelog

このプラグインの変更履歴です。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準じ、新しいものを上に置きます。各リリースの行末には、そのリリースに対応するスキルの `metadata.version` を記します（リリース本文から特定できるもののみ）。

## [Unreleased]

- 評価レポートに confound（Control 群の意図的欠陥）を明記
- verify-spec の誤った VDM-SL 規則 FAQ を削除
- 無効構文 `imports all from Prelude` を除去
- スキル文書の版・日付フッタを削除し CHANGELOG に集約
- docs のスキル数表記を 15 に統一
- `lint:docs`（`scripts/lint-docs.mjs`、`eval/lint-docs.allow`）を追加し `npm test` に組込み
- 例の検証証跡を再生成するスクリプト `scripts/regenerate-example-evidence.mjs` を追加。`examples/task-manager/evidence/` に型検査・PO 生成・QuickCheck（クリーン版と仕込みバグ2変種）・z3・実装テストのログと、記録環境つきの `verification.json`（schema_version 2）を収録
- 仕込みバグのパッチ `examples/task-manager/seed-bug.patch`（off-by-one のみ）と `seed-bugs-both.patch`（0045ff1 で修正した2件）を追加
- verify-spec の VDMJ コマンド参照を配布版の `vdmj.sh` に統一（QuickCheck の `-cmd "qc"` を追加）、smt-verify の `get-model` 手順と優先順位の記述を修正、conversion-examples の「Z3 4.13.0 で検証済み」を再確認可能な記述に変更
- スライド・スピーカーノート・Zenn 下書きの QuickCheck 出力を収録ログへの参照に置換
- 配信チャネル台帳 `docs/announce/CHANNELS.md` を追加
- 改善戦略文書 `design/improvement-strategy-2026-10.md`（根拠 `…-findings.md`）を追加
- 過去リリースに注釈付きタグ v0.1.0〜v2.2.0 を付与（v1.1〜v1.4 は plugin.json の版更新がなかったため v1.5.0 の注釈に記載）
- README の「使い方」をクイックスタート2段構成に再編（A：Java なしで契約定義 → コード生成 → 契約テストの実行まで／B：Java と VDMJ で仕様を機械的に検査）。A は define-contract 2.1.0・generate-code 0.4.1・generate-tests 2.2.0 以降が前提。スキル一覧の各表に「必要なもの」列を追加
- README のインストール手順を正規ブロック1つ（`install-block`。コミュニティ経路を先に、このリポジトリを直接指定する経路を「最新」として併記）にまとめ、インストール確認用のプロンプトを追加（スキルの数だけでは版を見分けられないため、define-contract と generate-tests の説明文の文言で確かめる。実際の Claude Code セッションでは未試行）。`lint:install`（`scripts/lint-install-block.mjs`）を追加し `npm test` に組込み（docs・スキル・`prompt-templates.md`・サイト辞書に載せたインストールコマンドが README のブロックと一致するか検査。サイト辞書は iid2 のチェックアウトがある場合のみ）
- `CONTRIBUTING.md` を追加（方針、変更前後に実行するコマンド、変更の種類ごとの追加作業、初回実行の報告の受付）
- define-contract 2.1.0：依頼文を先に読み、足りない項目だけを平易な言葉で1回にまとめて質問。仕様を必ず `<モジュール名>.vdmsl` に保存（既定はカレントディレクトリ）。PROTOCOL.md / API-SIGNATURES.md はエージェント間の通信がある場合のみ作成。完了報告を必須化（「決めたこと」の一覧、機械検証は未実行で Java は不要・不使用、次は generate-code → generate-tests）。VDM-SL の例を書き直し（`references/contract-templates.md` を含む）。書き直した例は、修正時に VDMJ 4.7.0 の構文チェック・型チェックで1回確かめたもの（手作業。断片は、参照する型を補ったモジュールに埋め込んで確認。ログは残していない）。自動の検査（下の `check:vdmsl`）は、追加時点の実行では全体が通らなかったが、2026-11-11 の実行では、define-contract の VDM-SL のブロックはすべて構文チェック・型チェックの対象になり、通った（ログは下の `check:vdmsl` の項目。構文チェックと型チェックだけで、証明ではない）
  - ラウンド2の後の変更（2026-11-11 のラウンド3は、この文面で実行した）：決め忘れやすい項目の先頭に「どの操作を用意するか」を追加（依頼文に出てくる操作と、それを使うのに最低限必要な操作にとどめ、黙って足さない）。ステータス変更の制限は、指定が無ければ「制限なし」。日本語などで挙げられた値は英語の PascalCase の引用型にし、対応をコメントと「決めたこと」に書く。1回の質問に入れる項目の優先順を追加。事後条件で表（map）を引くときの書き方の規則を追加し、テンプレートのパターン2・7の事後条件を修正（修正前は QuickCheck が反例を出した）。`references/contract-templates.md` から、generate-code と食い違う古い実装の助言（JavaScript への型変換表、「よくある実装上の問題と対策」）を削除
  - ラウンド3の後の変更（2026-11-11 のラウンド4は、この文面で実行した。チケットの状態遷移のテンプレートは、ラウンド4の依頼文では使われていない）：完了報告の例の操作名を、仕様の名前（`DeleteTask(id)`）に変更（どちらの名前で書くかの規則は足していない）。`references/contract-templates.md` のチケットの状態遷移で `Closed` を終端にした（`Closed` から `Closed` への遷移を認めない）
- generate-code 0.4.1：プロジェクトの慣習を検出するステップ2.7を追加。消去可能な構文のみの TypeScript と `.ts` 拡張子つきの相対 import を既定に。ファイル名・クラス名の規則を明記。完了報告を必須化（生成したファイル、export と正常・違反の呼び出し例、実行方法と型チェックの状況、`VDM_CONTRACT_CHECK`、仕様との表現上の差異、TODO スタブ、次のプロンプト）。`references/typescript-rules.md` に、モジュールと構文の規則、生成ファイルの型チェックの手順、操作前の値（`x~`）のスナップショット、値の構造的な等値比較を追加
  - ラウンド2の後の変更（ラウンド3は、この文面で実行した。Python の規則は未試行）：完了報告の呼び出し例に、契約違反のメッセージを1行で表示するコマンド（`node --input-type=module -e "…"`。型ストリッピングが使える構成のみ）を追加し、使えない構成では「未実行」と書く。型チェックの例のコマンドに `--ignoreConfig` を追加（TypeScript 6 以降。5.9 では付けない。5.9.3・6.0.3・7.0.2 で実測）。報告の末尾の2行（位置づけと、「仕様の機械検証（VDMJ）は未実行…」）を定型にした。`references/typescript-rules.md` に、不変式つきの型の別名の変換例（`invTitle` / `mkTitle`）を追加。暗黙的定義の例（`sqrt`）を正しい VDM-SL に修正（`references/python-rules.md` も）。`references/python-rules.md` のレコードの不変条件の検査を `contracts_enabled()` の外に出した（型の不変条件は `VDM_CONTRACT_CHECK=off` でも検査する）
  - ラウンド3の後の変更（ラウンド4は、この文面で実行した。「読み込みの確認」の結果は試行の報告に記載が無く、`"type"` の無い `package.json` がある構成はラウンド4に無い）：完了報告の「読み込みの確認」（`node generated/index.ts`）を、呼び出し例のコマンドと同じ3つの条件を満たす構成でだけ実行し、それ以外は理由つきで「未実行」と書く（`"type": "commonjs"` の `package.json` がある構成では、正しい出力でも失敗していた）。消去可能な構文と `import type` / `export type` を、プロジェクトによらず常に使う（プロジェクトに合わせるのは import の拡張子だけ）。`"type"` の無い `package.json` がある構成では、`ContractError` の行の前に Node.js の警告が出ることを追記。`references/typescript-rules.md` の TS2835・TS2580 の説明を、実測に合わせて限定
- generate-tests 2.2.0：ステップ0を追加（既存のテストランナーを検出して再利用。無ければ1回だけ質問：Vitest の最小構成（推奨。npm から取得）／Node.js 組み込みのテストランナー（依存なし）／テストファイルのみ）。テストは生成された実装を import。完了報告を必須化（実行コマンド1つ、実行ディレクトリ、結果の件数、条項の対応、契約違反の例、「テストの成功は機械検証ではない」「VDMJ は未実行」の行）。状態を持つ操作のテストの型（戦略 F）と、条項とテストの対応を毎回確かめる手順（3c）を追加。契約違反は実装が export するエラークラス（`ContractError`）で判定。`references/test-templates.md` の VDM-SL の入力例を修正。架空の CI 例と `npm run test:full` を削除
  - ラウンド2の後の変更（ラウンド3は、この文面で実行した）：「このテストだけを実行」の絞り込みについて、引数が正規表現として解釈されることと、一致が0件でも終了コード0で終わることを明記。記号を含まない部分文字列を使い、報告に書く前に実行して、対象のテストが実行されたことを確かめる（確かめられなければ「未確認のため省略」）。絞り込みは報告した実行コマンドに合わせた形にし、既存のランナーでは `npm test -- -t` を使わない。完了報告に「エラーを表示するコマンド」を追加（型ストリッピングが使える構成で、実行してから書く。使えない構成では「この環境では用意できない」）。条項の数え方（3c）を定義。Node.js 組み込みのテストランナーの可否を決める `package.json` は「カレントディレクトリから親へたどって最初に見つかるもの」と明記。ts-jest では、わざと不正な値を渡すテストにキャストが要ることを追記。Node.js 組み込みのテストランナーを選んだ場合は、テストファイルの先頭に実行コマンドと実行ディレクトリをコメントで書く。プロトコルテストは設計文書がある場合のみ、と冒頭と雛形に明記。`references/test-templates.md` の断片を自己完結にし、generate-code と食い違う変換表を削除
  - ラウンド3の後の変更（ラウンド4は、この文面で実行した。プロトコルテストの例とテンプレート5は、設計文書の無いラウンド4では使われていない。`"type"` の無い `package.json` がある構成も、ラウンド4に無い）：前提条件テストの例（戦略 B）のアサーションを、`.not.toThrow()` と `.toThrow(ContractError)` に変更。`references/test-templates.md` に、引数なしの `.toThrow()` は説明用だという注記を追加。プロトコルテストの例とテンプレート5で `Closed` を終端にした（`Closed` から `Closed` を、不正な遷移の側に移動）。完了報告の VDMJ の行を、define-contract・generate-code と同じ文面に揃えた。`"type"` の無い `package.json` がある構成での Node.js の警告を追記
- 初回実行の記録 `docs/onboarding-tests/` を追加：2026-11-10 の Java なし経路の記録（エージェントによる模擬試行、2ラウンド × 3経路。人による実行ではない）、推奨経路が生成したファイル一式（`2026-11-10-t1-vitest/`）、試行の後にラウンド2の3つの仕様に対して実行した QuickCheck のログ（`2026-11-10-quickcheck-logs/`。ローカルのパスは置換済み）
- 初回実行の記録に `docs/onboarding-tests/2026-11-11-round3-and-verify-spec.md` を追加：ラウンド2の後に直した文面で、同じ3つの経路をやり直したラウンド3（3試行とも最初の実行で成功。前回は一致0件で終わった絞り込みコマンドが、今回は対象のテストを実行した。既存の CommonJS のプロジェクトでは、契約違反を表示するコマンドは今も示されない）と、verify-spec の試行（クイックスタート B。作者のローカルに導入済みの Java と VDMJ を使用。構文チェック・型チェック・PO の生成と報告まで進んだが、major と判定された引っかかりが3件。Java が無い場合は「未実行」と報告）。どちらもエージェントによる模擬試行で、人による実行ではない。verify-spec の試行のログと対象の仕様を `2026-11-11-verify-spec-logs/` に収録（ローカルのパスは置換済み）。2026-11-10 の記録には、この記録への追記を2か所に加えた。上の各スキルの「ラウンド3の後の変更」と、verify-spec の「1回目の試行の後の変更」は、この項目の試行（ラウンド3と、verify-spec の1回目の試行）より後に加えたもので、この項目の試行は通っていない。その後のラウンド4（下の「初回実行の記録（2026-11-11 追記）」の項目）が、変更後の文面で実行された
- `examples/task-manager/README.md` の冒頭に日本語の説明を追加（テストの実行、`evidence/` の読み方、証跡の再生成、現在の generate-code / generate-tests の出力とのファイル構成の違い）
- verify-spec（`metadata.version` は 2.0.0 のまま）：単独のエージェントで PROTOCOL.md / API-SIGNATURES.md が2つとも無い場合は、設計文書レビューを欠落エラーにせずスキップし、報告に「対象なし」と書く。テスト生成の提案では、実装が無ければ先に generate-code を案内し、プロトコルテストは設計文書がある場合のみとした
  - verify-spec の1回目の試行（2026-11-11）の前の変更（1回目の試行は、この文面で実行した）：対象の仕様をまず自分で探す（カレントディレクトリの `.vdmsl` が1つなら質問しない。モジュール名はファイルから読む）。ステップ1b を追加（`java -version` と `command -v vdmj.sh` を実行して確かめ、`vdmj.sh` が PATH に無ければ場所を1回だけ尋ねて絶対パスで起動する。起動できなければ「未実行」と報告する）。報告例の VDM-SL を、define-contract が書く形に修正。「よくある検証エラーと修正例」を、VDMJ 4.7.0 の実際の動作に合わせて「よくある警告・指摘と修正例」に改めた（未定義の引用値との比較は警告。充足できない不変式は構文チェック・型チェックを通るので、レビューの指摘）。`references/vdmj-setup.md` に「インストール後の確認」を追加
  - 1回目の試行の後の変更（ラウンド4の verify-spec の試行は、この文面で実行した。通ったのは、ステップ3bの順序、ステップ7の報告形式、実装とテストが既にある場合の提案と既存のテストの実行、QuickCheck の提案と実行、smt-verify の提案、`java -version` が失敗しても止めないこと、起動できないときの「未実行」の報告と導入手順の伝達、`evidence/` への保存とハッシュ、場所を尋ねる質問の文例。通っていないのは、提案の残りの2つの場合、smt-verify の実行、QuickCheck が反例を出した場合の報告、空白を含むパスの代わりの起動方法、設計文書レビューの例、指摘2の修正例、`vdmj-setup.md` の手順どおりの導入）：PO の生成を、型チェックの直後・レビューの前に移動（ステップ3b）。PO は VDMJ の番号と種類の名前で参照し、独自の番号や「難易度」を付けない。最終報告をステップ7の報告形式1つにまとめ、「警告」「POの内訳」「不変式・契約のレビュー」の欄を追加。各ステップの例を、VDMJ 4.7.0 の実測の出力か、「そのまま出力しない記入例」に変更。次の一歩の提案を3つの場合に分けた（実装が無ければコード生成、実装はあるがテストが無ければテスト生成、両方あれば既存のテストを実行するかどうかを尋ねる）。未証明の PO が残っていれば、QuickCheck（配布版の `vdmj.sh` の場合のみ）と smt-verify を、任意の追加確認として添える。`java -version` が失敗しても止めずに `vdmj.sh` を探し、`vdmj.sh -v` で判断する。起動できないときは、導入手順を回答の中で伝える。ログを仕様の隣の `evidence/` に保存する形と、ハッシュの取り方を追加。`vdmj.sh` の場所を尋ねる質問の文例と、パスに空白がある場合の代わりの起動方法（`java -jar`）を追加。ステップ4・5の対象に、状態の不変式と操作を明記。複雑な不変式の修正例（指摘2）を、QuickCheck が反例を出さない形に修正。6c の例の型と関数名を、他のステップと統一。`references/vdmj-setup.md` を「Java → VDMJ → 確認」の順に書き直した（JDK の入れ方と `JAVA_HOME`・`PATH`、ZIP を保存したディレクトリへの移動、展開されたディレクトリ名の確認、単体 jar のフルパス、必要なコマンド、空白を含むパスの注意、QuickCheck の判定の説明。インストーラやパッケージマネージャを使う方法・Linux・ソースからのビルドは「実行していない」と文書に明記）。`references/verification-results.md` の例のパスを、辿れる形に修正
  - ラウンド4の後の変更（この文を足した後の文面での試行は無い）：ステップ8の QuickCheck の項に、`PROVABLE` の書き方を追加（QuickCheck の戦略がその PO を成り立つと判定したという VDMJ の出力であり、件数と番号を `QuickCheck:` の行にそのまま書いて「証明済み」などと言い換えない。「PO証明: 未実行」の行は変えない。件数は PO ごとの行を数えて書く）。ラウンド4で major と判定された引っかかりへの対応で、ラウンド4のエージェントが自分の判断で行った書き方を定めたもの
- integrated-workflow（`metadata.version` は 2.1.0 のまま）：Java か VDMJ が無い場合は Phase 2 を合格扱いにせず、README のクイックスタートの3つのプロンプトを案内する指示を追加。生成コードの出力先を、generate-code と同じ「仕様ファイルの隣の `generated/`」に変更。Phase 1 の説明を define-contract 2.1.0 に合わせた。`references/workflow-phases.md` と reverse-workflow の `references/reverse-phases.md` の「検証済みとみなす」を、「verify-spec の結果が無ければ検証済みと書かない」に変更
  - 追加の変更（未試行。このワークフローは、どの試行の対象にもなっていない）：Phase 5 は、このスキル自身が書くスモークテストであり、generate-tests を呼び出さないことを明記。TypeScript のスモークテストは、型ストリッピングが使える Node.js で、生成コードが generate-code の既定の形なら `node <テストファイル>.ts` で実行する（何も取得しない）。それ以外はプロジェクトの TypeScript ランナーを使い、`npx tsx` は npm から取得する前に利用者に確認する。完了サマリのテストファイルの行を、実際に書いたファイルのパスにした
- extract-spec（`metadata.version` は 1.1.0 のまま。未試行）：`references/code-to-vdmsl-mapping.md` で、`float` / `double`（と、整数でない値を持つ TypeScript の `number`）を `real` に対応づけた（「VDM-SL に直接の対応なし」という記述を削除。金額など厳密な値が要る場合は [QUESTION] を付ける）。SKILL.md の例の不変式 `s in [...]` を、正しい VDM-SL（`s in set {...}`）に修正し、例が使う `email_valid` の定義を追加。マッピングの例を、単独で、または構文だけ検査できる形に整理。解決できなくなっていたリンクを、Overture のマニュアルのページに差し替え
- refine-spec（`metadata.version` は 1.2.0 のまま。未試行）：Before / After の例を、擬似記法から正しい VDM-SL に書き直し（タグは `--` のコメントとして書く）。`Refund` の事前条件に `amount > 0` を追加（追加前は QuickCheck が事後条件に反例を出した）
- formal-methods-guide（`metadata.version` は 0.1.0 のまま。未試行）：`references/po-types-detail.md` の PO 種別の一覧を、VDMJ 4.7.0 の jar から読み取った46種（表示される名前つき）に差し替え（以前は「全38種」として、4.7.0 に無い名前を含んでいた）。関数の事後条件の PO の名前を、VDMJ の表示どおり `postcondition obligation` に修正（SKILL.md の表も）。`references/vdm-sl-syntax.md` の暗黙的定義の例（`sqrt`）を正しい VDM-SL に修正し、例に足りなかった型と状態の定義を追加
- import-natural-spec（`metadata.version` は 1.0.0 のまま。未試行）：出力の形を示す例を、型チェックが通るモジュールに修正（足りなかった型の定義と `end` を追加。`RegisterUser` の事後条件が「新しい ID は操作前の表にある」と読める誤りを修正）
- route-models（`metadata.version` は 1.0.0 のまま）：`references/routing-rules.md` の模式的な例に、`check:vdmsl` の対象外であることを示すマーカーを追加。スキルの動作は変わらない
- `check:vdmsl`（`scripts/check-skill-vdmsl.mjs`）を追加：`skills/` の Markdown にある VDM-SL のコードブロックを VDMJ の構文チェック・型チェックにかける。Java が要るので `npm test` には含めない。VDMJ が無ければ `skipped` と表示して終了コード0で終わる（合格ではない）。単独で検査できないブロック用のマーカー `<!-- vdmsl-check: skip|syntax-only reason="…" -->` を定義。追加時点（2026-11-10）の実行では失敗するブロックがあり、全体は通らなかった（検査スクリプトの作成時の実行結果。そのログは未収録）。その後、失敗していた例は、正しい VDM-SL に直すか、マーカーを付けた（上の各スキルの項目）。2026-11-11 の実行（VDMJ 4.7.0、作者のマシン）では、検査の対象になったブロックがすべて通った（ログは `docs/onboarding-tests/2026-11-11-check-vdmsl.txt`。マーカーで対象から外したブロック、構文だけを検査したブロック、断片として検査しないブロックも、ログにある）。通ったというのは、VDMJ が構文解析と型チェックを終えたという意味で、証明ではない。使い方は CONTRIBUTING.md
- `prompt-templates.md`：テンプレート1とコツ3を define-contract 2.1.0 の進め方（質問は1回にまとめる。既定値は「決めたこと」に列挙）に合わせ、Java なしでテストの実行まで進む3つのプロンプトへの案内を追加。テンプレート3とコツ4に Java と VDMJ が必要であることを追記。テンプレート7を generate-tests 2.2.0 に合わせた（先にコード生成、テストランナーの指定は任意）
- スライド・スピーカーノート・Zenn 下書き：「今すぐ試せます」を3つのプロンプト（契約定義 → コード生成 → 契約テスト生成。Java 不要）に変更し、その手順が前提とするスキルの版と、コミュニティ経路の版が追従していない場合の入れ方を注記。「仕様を検証して」で QuickCheck まで実行されるかのような記述を訂正（verify-spec が実行するのは構文チェック・型チェック・PO 生成まで。QuickCheck は VDMJ を別コマンドで実行）。スライドの検証デモは「実測出力」ではなく収録ログから構成した抜粋であることを明記し、ログの再生成で変わる所要時間の表示を削除
- `docs/announce/CHANNELS.md`：台帳を 2026-11-10 の状態に更新し、改善戦略 P3 の実施状況（P2 より先に実施したこと、未実施の項目）を追記。2026-11-11 の追記を加えた（ラウンド3と verify-spec の試行、verify-spec が報告の後に QuickCheck を提案するようになったこと、verify-spec と integrated-workflow の版番号を上げていないこと）。ラウンド4の後に、もう1つ追記を加えた（ラウンド4の結果、QuickCheck の提案が1回実行されたこと、前の追記と表の「未試行」はラウンド4より前の記述であること、スライドの PDF とサイトが未同期であること）
- README（2026-11-11）：クイックスタート B を、verify-spec の模擬試行の結果に合わせて更新（`vdmj.sh` が PATH に無いときは場所を1回尋ねること、模擬試行が2回であることと、それが確かめた範囲、導入手順どおりに Java と VDMJ を入れる実行は未試行であること、報告の後の QuickCheck の提案は2回目の試行で1回実行されたこと）。B の長さを変えないために、evidence ディレクトリへの直接のリンクと、プロンプト雛形の内訳の説明を省いた。スキル一覧の integrated-workflow の行と、セットアップの表の Node.js の行を、Phase 5 の現在の動作（条件が合えば `node` だけで実行し、何も取得しない。`npx tsx` は取得の前に確認する）に合わせた。「今後の予定」の QuickCheck の項目を「verify-spec の検査手順への組込み（いまは報告の後の任意の提案だけ）」に書き換え
- スライド・スピーカーノート・Zenn 下書き（2026-11-11）：スライド S10 の前提の版に generate-code 0.4.1 を追加（他の文書と同じ3つの版に揃えた）。Zenn の「試したい方へ」に、3つのプロンプトの流れを通しで確かめたのはエージェントによる模擬試行だけであること（人が計った時間も、実際の Claude Code セッションでの通し実行も無い。記事の依頼文では試していない）を追記。QuickCheck についての記述（スライド S6 の注記、スピーカーノート、Zenn）を、verify-spec の現在の文面（報告の後に任意で提案する。検査手順への組込みは予定）に合わせ、この提案から実行までを確かめたのは、エージェントによる模擬試行（ラウンド4）の1回だけであることを書いた。スライドの PDF は再生成していない
- 初回実行の記録（2026-11-11 追記）：`docs/onboarding-tests/2026-11-11-round3-and-verify-spec.md` にラウンド4を追記（ファイル名はそのまま）。ラウンド3と verify-spec の1回目の試行の後に変更した文面で、同じ3つの経路と verify-spec をやり直した。エージェントによる模擬試行で、人による実行ではない。3つの経路は、3試行とも最初の実行で成功し、絞り込みコマンドは3試行とも対象の1件だけを実行した。既存の CommonJS のプロジェクトでは、契約違反を表示するコマンドは今も示されない。引っかかりは10件で、すべて minor の判定。verify-spec は、作者のローカルに導入済みの Java と VDMJ で、構文チェック・型チェック・PO の生成と報告まで進み、報告の後の提案からユーザー役が選んだ、既存のテストと QuickCheck を実行した（件数と判定は記録とログ）。Java も VDMJ も無い場合は、すべての項目を「未実行」と報告し、導入手順を回答の中で伝えた。verify-spec の引っかかりは11件で、major と判定されたものが1件ある（QuickCheck の `PROVABLE` を報告でどう書くかが、文面で決まっていない）。**ラウンド4で報告された引っかかりのうち、対応したのはこの major の1件だけ**（verify-spec のステップ8に、`PROVABLE` の件数と番号をそのまま書いて「証明済み」などと言い換えず、「PO証明: 未実行」の行は変えない、という文を足した。ラウンド4のエージェントが自分の判断で行った書き方を定めたもので、この文を足した後の文面での試行は無い）。ほかの引っかかりには対応していない。 導入手順どおりに Java と VDMJ を入れる実行、複数のエージェントが通信する仕様、Python、プラグインを読み込んだ実際の Claude Code セッション、人による実行は、今も無い。ラウンド4の verify-spec のログを `2026-11-11-verify-spec-logs/round4/` に、2026-11-11 の `npm run check:vdmsl -- --require` の出力を `docs/onboarding-tests/2026-11-11-check-vdmsl.txt` に収録（どちらもローカルのパスは置換済み。後者は試行の記録ではなく、スキルの中の VDM-SL のブロックの構文チェック・型チェックの結果）。`docs/onboarding-tests/README.md` の一覧と「まだ無い記録」、2026-11-10 の記録（`check:vdmsl` についての追記）を更新
- `eval/lint-docs.allow` の項目が無くなった（許可していた1行は `references/vdmj-setup.md` の Maven の URL の行で、書き直しによって該当しなくなった）。`scripts/lint-docs.mjs` の、VDMJ の jar のファイル名を直接書いた場合に表示するヒントを修正（存在しないスクリプト `scripts/vdmj` を案内していた。配布版の `vdmj.sh` と `vdmj-setup.md` を案内する）

## [2.2.0] - 2026-07-03

- 契約駆動モデルルーティング（route-models）：契約の客観的な複雑度シグナルからモジュールごとに能力が足りる範囲で最も軽いモデル層（light/standard/heavy）を割り振り、生成フェーズのトークン消費を削減。検証ゲートは不変で、同一モジュールで2回検証に失敗した場合のみ自動で1層エスカレーション
- スキル版：route-models 1.0.0、generate-tests 2.1.0、integrated-workflow 2.1.0、generate-code 0.4.0、define-contract 2.0.0、verify-spec 2.0.0、generate-db-schema 2.1.0、smt-verify 0.2.0、formal-methods-guide 0.1.0、extract-spec 1.1.0、refine-spec 1.2.0、reconcile-code 1.3.0、reverse-workflow 1.4.0、import-natural-spec 1.0.0、export-human-spec 1.0.0

## [2.1.0] - 2026-07-02

- DBスキーマ導出（generate-db-schema）：型・不変条件→DDLの規則的写像（R1〜R18）、retrenchment に基づく乖離記録（DEVIATIONS）、不変条件の担保箇所対照表（TRACEABILITY）
- スキル版：generate-db-schema 2.1.0（新規）

## [2.0.0] - 2026-04-12

- Phase 2設計文書（PROTOCOL.md、API-SIGNATURES.md）生成支援、契約テスト自動生成（generate-tests）、設計文書の完全性チェック（verify-spec拡張）
- スキル版：define-contract 2.0.0、verify-spec 2.0.0、generate-tests（新規）

## [1.5.0] - 2026-04-02

- import-natural-spec / export-human-spec（自然言語仕様の入出力）
- スキル版：import-natural-spec 1.0.0、export-human-spec 1.0.0

## [1.4.0] - 2026-04-01（v1.1.0〜v1.4.0）

- リバースワークフロー（extract-spec、refine-spec、reconcile-code、reverse-workflow）、評価フレームワーク
- スキル版：extract-spec 1.1.0、refine-spec 1.2.0、reconcile-code 1.3.0、reverse-workflow 1.4.0

## [1.0.0] - 2026-04-01

- 統合ワークフロー（integrated-workflow）、ドキュメントの日英対応
- スキル版：integrated-workflow（新規）

## [0.3.0] - 2026-04-01

- コードスキャフォールド生成（generate-code、TypeScript/Python）
- スキル版：generate-code（新規）

## [0.2.0] - 2026-04-01

- SMT-LIB変換とZ3証明（smt-verify）
- スキル版：smt-verify 0.2.0

## [0.1.0] - 2026-03-31

- 初版（define-contract、verify-spec、formal-methods-guide）
- スキル版：formal-methods-guide 0.1.0、define-contract（新規）、verify-spec（新規）
