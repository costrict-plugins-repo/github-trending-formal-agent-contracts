# 2026-11-10 t1-vitest（ラウンド2）の生成物

[2026-11-10 の模擬試行](../2026-11-10-java-free-agent-trials.md)のうち、空のディレクトリで Vitest の最小構成を選んだ試行（`t1-vitest-r2`）が生成したファイルを、手を加えずに写したものです（`node_modules/` と `package-lock.json` は含めていません）。仕様・実装・テストはいずれも同じモデルが書いたもので、テストが通ることは仕様の機械検証ではありません。

実行するには、このディレクトリで `npm install`、続けて `npm test` を実行します（Node.js が必要です。Java は不要です。`npm install` は npm から Vitest を取得し、`node_modules/` と `package-lock.json` を作ります。これらはコミットしません）。
