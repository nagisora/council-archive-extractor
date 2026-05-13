# 名古屋市会議録（kaigiroku）取得経路の調査メモ

対象: `https://ssp.kaigiroku.net/tenant/nagoya/` テナント（`tenant_id=207`）。

## 結論（2025 年データで確認）

- **一覧・会議録本文の取得は JSONP（`Content-Type: application/javascript`）が主**である。  
- **本文は PDF ではなく、JSON 内の HTML 文字列**（`<pre>` に会議録プレーンテキスト）として渡ってくる。  
- 閲覧用の人間向け URL は `SpMinuteView.html` にクエリを付けたもの。

## 代表的な API

| 用途 | メソッド | パス（例） | 備考 |
|------|----------|------------|------|
| 年度一覧等 | GET | `/dnp/search/councils/get_view_years?callback=…` | JSONP |
| 会議ツリー | GET | `/dnp/search/councils/index?callback=…` | JSONP。`councils` ツリーに `council_id` と会議名 |
| 本会議の日程一覧 | GET | `/dnp/search/minutes/get_schedule_all?callback=…` | JSONP。`schedule_id` と表示名 |
| 会議録本文 | GET | `/dnp/search/minutes/get_minute?callback=…` | JSONP。**本文は `tenant_minutes[]` 配列**。各要素に `minute_id`, `title`, `page_no`, `body`（HTML） |

## 人間がブラウザで開く会議録 URL（例）

令和7年2月定例会（`council_id=650`）の **03月06日－04号**（`schedule_id=5`）:

`https://ssp.kaigiroku.net/tenant/nagoya/SpMinuteView.html?power_user=false&tenant_id=207&council_id=650&schedule_id=5&view_years=2025`

**注意**: `council_id` のみでは `get_minute` が 400 となるケースがあり、**`schedule_id`（と `view_years`）が必須**。

## `get_minute` レスポンスの形（要旨）

トップレベル JSON（JSONP の内側）例:

```json
{
  "tenant_minutes": [
    {
      "minute_id": 1,
      "title": "（名簿）",
      "page_no": 1,
      "hit_count": 0,
      "body": "<pre>…</pre>"
    }
  ]
}
```

- `body` からタグを除去し、**プレーンテキスト**としてパイプラインに渡すのがよい。  
- **PDF ダウンロード**用の別エンドポイントが存在する可能性はあるが、本会議本文の取得には必須ではない（必要になったら `minutes/download?...` 系を再調査）。

## ローカルでのネットワーク確認

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run capture:kaigiroku
```

`tools/capture-kaigiroku-network.mjs` が `ssp.kaigiroku.net` 宛てのレスポンス URL・`Content-Type`・ボディサイズを列挙する。

## コネクタ実装の推奨方針

1. **HTTP クライアントで JSONP をパース**する（`callback=` を剥がして JSON 化）か、既存ライブラリで jQuery 互換 JSONP を扱う。  
2. `councils/index` から `council_id` を解決 → `get_schedule_all` で `schedule_id` を列挙 → `get_minute` で本文取得。  
3. 自治体横展開時は **テナント ID・パス構造をパラメータ化**する。

以上。
