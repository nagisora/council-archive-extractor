# ゴールデンラベル（人手基準）

抽出パイプラインの回帰確認用に、**議事録テキスト内に必ず含まれるべき部分文字列**を JSON で保持する。条例の説明全文のラベル化は作業量が大きいため、MVP ではまず **本会議の議題見出し行** を照合対象とする（後から `gold_must_contain_all` を拡張する）。

## ファイル命名

- `fixtures/golden-labels/*.golden.json`

## 評価コマンド

抽出結果を 1 つのプレーンテキスト（コーパス）に連結したうえで:

```bash
pnpm exec node tools/evaluate-golden.mjs path/to/corpus.txt
```

## テスト用スニペット

`fixtures/corpus-snippets/teigi202502-sched5-agenda-excerpt.txt` は、令和7年2月定例会（`council_id=650`）の `schedule_id=5`（03月06日－04号）冒頭の議題見出しから必要行のみ抜粋したもので、`pnpm run eval:golden` の動作確認に使える。
