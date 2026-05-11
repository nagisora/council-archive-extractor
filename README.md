# council-archive-extractor

議案一覧と議事録から、議案内容の全文引用を取得するためのリポジトリ（MVP 準備中）。

## ドキュメント

- MVP 方針・JSON ドラフト: `docs/mvp/README.md`
- ツール手順: `docs/mvp/tools.md`
- 調査メモ: `docs/mvp/research/`

## 開発用コマンド

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run capture:kaigiroku
pnpm run eval:golden:fixture
pnpm run test:integration:r7-202511
```

統合テストの結果 JSON は `fixtures/integration-results/r7-202511-five-bills.json` に出力される。

