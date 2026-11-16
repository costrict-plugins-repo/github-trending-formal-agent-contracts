# コントリビューションガイド

このリポジトリは Claude Code プラグイン（スキルの Markdown 群）と、その主張を再現するための例・スクリプトで構成されています。変更を送る前に、次の方針と確認手順を読んでください。

## 方針

- **新しいスキルは当面追加しません。** 既存の15スキルすべてに「CI で検査される実行例」が揃うまで、追加より既存スキルの確実さを優先します。CI はまだありません（[README の「今後の予定」](README.md#今後の予定)にある未同梱の項目です）。現時点で機械的に検査しているのは、下の `npm test` の範囲だけです。新スキルの提案は Issue で受け付けますが、マージは上の条件が満たされてからです。
- **`eval/` は過去の記録です。** 対照群に意図的な欠落があり、旧採点器には既知の問題があります（[eval/README.md](eval/README.md)）。README・記事・サイトで、プラグインの効果を示す根拠として使わないでください。
- **数値は転記しません。** 証明責務の件数や QuickCheck の内訳などは [examples/task-manager/evidence/](examples/task-manager/evidence/) の記録にリンクし、README やスキル本文に書き写しません。書き写した数値は古くなります。
- **確認していないことを書きません。** 「検証済み」「証明済み」と書けるのは、ツールの出力がリポジトリに残っている場合だけです。LLM が書いた仕様やテストを機械検証と呼びません。
- **SKILL.md に日付・版数のフッタや「新機能」バッジを入れません。** 変更は [CHANGELOG.md](CHANGELOG.md) に書きます。

## 変更前後に実行するもの

Node.js 22 以上が必要です。Java は不要です。

```sh
npm ci --ignore-scripts
npm test
```

`npm test` は次の4つを順に実行します。

| コマンド | 内容 |
|---|---|
| `npm run lint:docs` | 取り下げた表現や誤った VDM-SL 記法の再混入、スキル数の不一致を検出 |
| `npm run lint:install` | README の正規インストールブロックと、`docs/`・`skills/`・`prompt-templates.md`・サイト辞書に載せたインストールコマンドが一致するか検査。サイト辞書を検査するのは、iid2 のチェックアウトが `$IID2_DIR` か `../iid2` にある場合だけで、無ければ `site: skipped` と表示して残りだけで合否を決める |
| `npm run test:eval` | 評価用スクリプトの回帰テスト |
| `npm run test:example` | `examples/task-manager` の実装テスト（ランタイム契約チェック有効） |

`npm test` に含めていない検査が1つあります。Java が要るためです。

| コマンド | 内容 |
|---|---|
| `npm run check:vdmsl` | `skills/` の Markdown にある VDM-SL のコードブロック（言語タグが `vdm-sl`・`vdmsl`・`vdm` のもの）を取り出し、単独で検査できるものを VDMJ の構文チェック・型チェックにかける（証明責務の生成や QuickCheck はしない）。Java と VDMJ の配布版が必要 |

- VDMJ の起動スクリプトは環境変数 `VDMJ_SH`（既定は PATH 上の `vdmj.sh`）、Java は `JAVA_HOME` で指定します。VDMJ の入れ方は [vdmj-setup.md](skills/verify-spec/references/vdmj-setup.md) にあります。
- VDMJ が見つからない場合は `skipped` と表示し、何も検査せずに終了コード0で終わります。これは合格ではありません。`npm run check:vdmsl -- --require` とすると、その場合に終了コード2になります。
- 単独では検査できないブロックには、直前の行に `<!-- vdmsl-check: skip reason="…" -->`（検査しない。わざと誤りを見せる例や、`...` を含む雛形）か `<!-- vdmsl-check: syntax-only reason="…" -->`（構文だけ検査する。別のブロックで定義した名前を使う例）を置きます。理由は必須です。分類の規則は `scripts/check-skill-vdmsl.mjs` の冒頭のコメントにあります。
- 2026-11-10 にこの検査を追加した時点の実行では、単独では名前を解決できないブロックなどが失敗になり、全体は通りませんでした（検査スクリプトの作成時の実行結果。そのログはリポジトリに収録していません）。その後、失敗していた例は、正しい VDM-SL に直すか、上のマーカーを付けました。2026-11-11 の実行（VDMJ 4.7.0、作者のマシン）では、検査の対象になったブロックはすべて通っています（[ログ](docs/onboarding-tests/2026-11-11-check-vdmsl.txt)。マーカーで対象から外したブロック、構文だけを検査したブロック、断片として検査しないブロックも、ログに出ています）。
- 「通った」は、VDMJ がそのブロックの構文解析と型チェックを終えた、という意味です。例の内容が正しいことや、証明されたことは意味しません。この検査は `npm test` に含まれないので、`skills/` の VDM-SL を変えた後の状態は、VDMJ のある環境で `npm run check:vdmsl -- --require` を実行して確かめてください。失敗したブロックは、自己完結させるか、理由を書いたマーカーを付けます。

## 変更の種類ごとの追加作業

| 変更したもの | 追加で必要なこと |
|---|---|
| `evidence/verification.json` にハッシュが記録されている入力のどれか：`examples/task-manager/` の仕様・実装・テスト・`run-tests.cjs`・SMT サンプル（`smt/`）・仕込みバグのパッチ、またはルートの `package.json`・`package-lock.json` | `scripts/regenerate-example-evidence.mjs` で `evidence/` を再生成する（Java・VDMJ・Z3 が必要。手順は [examples/task-manager/README.md](examples/task-manager/README.md)） |
| インストール手順 | README の `install-block` だけを書き換え、他の掲載先はそこからコピーする |
| スキルの追加・削除・改名 | README のスキル表、`.claude-plugin/` の説明文、CHANGELOG を更新する |
| スキルの動作や前提ツール | README のスキル表の「必要なもの」列とクイックスタートを確認し、CHANGELOG に書く（`metadata.version` を上げた場合はその版も）。define-contract・generate-tests の `description` を変えた場合は、README の「インストールの確認」が版の見分けに使っている文言も確認する |
| `skills/` の中の VDM-SL のコードブロック | Java と VDMJ があれば `npm run check:vdmsl` を実行する。無ければ `skipped` になるので、VDMJ で確認していないことをプルリクエストに書く |

サイト（iid.systems）の該当ページは作者が同期します。プルリクエストでは、サイトに影響しそうな変更点を本文に書いてください。

## 初回実行の報告を歓迎します

README のクイックスタートを試した結果は、うまくいかなかった場合ほど役に立ちます。Issue に次の3点を書いてください。

- 環境（OS、Node.js の版、Claude Code の版、Java の有無）
- どのプロンプトの後で止まったか
- 表示されたメッセージ、または期待と違った点
