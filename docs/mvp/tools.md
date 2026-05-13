# 開発用ツール（MVP）

## Playwright によるネットワーク観測

`tools/capture-kaigiroku-network.mjs`

- 名古屋テナントの閲覧ページを開き、`ssp.kaigiroku.net` 宛てレスポンスの URL / `Content-Type` / サイズを標準出力する。
- 初回はブラウザ取得が必要:

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run capture:kaigiroku
```

## ゴールデンラベル評価

`tools/evaluate-golden.mjs`

- `fixtures/golden-labels/*.golden.json` の `evaluation.gold_must_contain_all` を、抽出結果テキスト（コーパス）に対して検証する。

```bash
pnpm exec node tools/evaluate-golden.mjs path/to/corpus.txt
```

リポジトリ同梱の抜粋コーパスで動作確認:

```bash
pnpm run eval:golden:fixture
```

## 統合テスト（市サイト＋議事録）

令和7年11月定例会の市長提出案件を **5 件** 選び、議事録（kaigiroku）の市長提案説明から該当段落を切り出す:

```bash
pnpm exec playwright install chromium
pnpm run test:integration:r7-202511
```

結果は **`fixtures/integration-results/r7-202511-five-bills.json`** に保存される（Git で追跡可能）。別パスにしたい場合は `OUT_PATH` を指定する。
