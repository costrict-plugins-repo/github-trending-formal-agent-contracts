# 評価資料と再現可能な fixture 検証

## 現在の証拠の位置付け

`runs/` と `results/` は過去の成果物・集計のアーカイブです。Control の実装には
**意図的な仕様の欠落**があります（[記録](runs/control/INTENTIONAL_GAPS.md)、
[オークションの記録](runs/control/README.md#intentional-gaps-from-spec)）。
同一モデルによる生成やキーワード採点の制約に加え、この介入があるため、
群間差をプラグインの有効性の因果的な証拠として使えません。
欠陥を含む教材・検出器の fixture として扱います。

過去の mutation 集計は、そのまま保存しています。元 sandbox の実行スクリプトは
未保存であり、保存された `100%` を今回の実装で独立に再現したわけではありません。
旧 runner には「実行失敗を kill と数える」「型構文まで置換する」問題がありました。
新 runner は別の手続き・別の結果形式なので、旧数値を置き換えません。

## 新しい mutation runner

Node.js 22 以上と、このリポジトリの固定された開発依存を使います。
旧 TypeScript エントリーポイントを直接実行する場合は Node.js 22.18 以上が必要です。

```sh
npm ci --ignore-scripts
npm run test:eval
npm run eval:mutate -- --project eval/fixtures/mutation-smoke --source rules.ts --test rules.test.ts
```

smoke fixture は、正常な基準テストに加えて、検出される境界変異1件と、意図的に
未テストの演算変異1件を含みます。期待結果は `killed: 1 / survived: 1` です。
これは判定器の動作確認であり、プラグインの効果測定ではありません。

- `--project`、`--source`、`--test` を明示します。複数テストは `--test` を繰り返します。
  最初に見つかった `.ts` を実装とみなす探索はしません。テスト名のファイルは変異対象にできません。
- 基準となる未変更の実装で、指定テストの検出・型検査・実際の assertion の合格を確認します。
  基準が失敗した場合は変異を実行せず、kill rate も出しません。
- TypeScript AST の二項式から比較演算子と `+/-` を選び、**1件につき1か所**だけ変更します。
  ジェネリック型・コメント・文字列内の記号には触れません。
- 各ケースを入力 snapshot から別ディレクトリに作り直します。元の入力を変更しません。
  コンパイルと Jest は固定されたローカル依存を使い、`npx` による自動取得をしません。
- 実行可能な変異で実際の assertion が失敗した場合のみ `killed`、全て合格なら `survived`。
  `compile-error`、`timeout`、`infra-error` は別集計し、kill rate の分母にも入れません。
  Jest の起動失敗、レポート欠損、テスト集合の変化、テスト未実行は kill になりません。
  実行されていたテストのskip化、setup/teardown hook失敗、global error、test retryも環境上の
  不確実さとして除外します。hook内でしか検出されない変異も保守的に `infra-error` となります。
- kill rate は `killed / (killed + survived)` の **0～1** の比率です。実行可能な変異がなければ `null`。
  分母と除外件数を併記します。compile-error は静的型検査で拒否された変異であり、テストによる検出ではありません。
- CLI は `completed` のみ終了コード0です。基準失敗や環境エラー・タイムアウトは非0。
  surviving mutant はテスト不足を調べる材料であり、runner の実行失敗ではありません。

結果は毎回新しい `eval/artifacts/run-…/` に保存します。`--out NEW_DIR` で変更できますが、
既存ディレクトリや過去の `eval/results/` への出力は拒否します。`--max-mutants N` は
AST の走査順（親ノード優先）で先頭N件に絞り、全候補数と選択数を記録します。`--timeout-ms` は各 subprocess、
`--test-timeout-ms` は各 Jest test/hook の制限です。

`report.json` には入力・runner・lockfileのSHA-256、Node/TypeScript/Jest/ts-jestの版、
設定、各変異の位置、判定、集計を記録します。各ケースには入力workspace、Jest設定、
実行コマンド・終了コード・所要時間、stdout/stderr、Jest JSON結果、型検査診断が残ります。
Jestの実行フェーズは `jest-events.jsonl` に残し、hook失敗とテスト本体の失敗を区別します。
`eval/artifacts/` はGit管理対象外です。公開する証拠は必要な結果だけを確認して選んでください。

### 対応範囲

この初版はローカルの自己完結した **CommonJSとして実行できるTypeScript＋Jest fixture** 用です。
コンパイラ条件はES2022・strict・CommonJSで、fixture独自のビルド手順やtsconfigを再現しません。
Vitest形式の過去データを自動でJestへ書き換えず、未対応の依存やビルド設定は失敗として報告します。
シンボリックリンクを含む入力は拒否し、`node_modules`・`.git`・`artifacts` はsnapshotから除外します。
ケースごとのworkspaceは分離しますが、セキュリティsandboxではありません。
テストコードは通常のローカルプログラムとして実行されるため、実行を認めたfixtureを指定してください。

演算子セットは限定的で、等価変異の自動除外・並行性の変異・形式仕様との同値性証明は行いません。
この結果単独では、コード全体の正しさやプラグインの改善効果を証明できません。

## 過去のヒューリスティック集計

`scripts/eval-runner.ts` は歴史的なキーワード指標の再集計用です。テストを実行しません。
再実行の出力は `artifacts/legacy-heuristics-…/` へ保存し、元の `results/` を上書きしません。
今後の効果比較は、独立した生成・同一予算・隠した評価テスト・複数モデルを用いた新しい実験として設計します。
