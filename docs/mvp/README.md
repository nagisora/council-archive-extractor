# MVP 開発資料（名古屋市議会・議案内容の取得）

議案一覧では議案名と可決／否決のみが公開され、**議案の本文・趣旨が分かりにくい**問題に対し、**議事録から議案名に対応する記述を全文引用**して取得するアプリの MVP 方針をまとめる。

---

## 1. 目的とゴール（MVP）

| 項目 | 内容 |
|------|------|
| ゴール | 議事録に記載された**議案内容に相当する記述の全文引用**を、議案単位で取得・保存する |
| 要約 | 本アプリでは行わない。必要なら別アプリで対応 |
| 出力形式 | **テキスト**および**JSON**（初期は JSON を主とする） |
| 対象自治体 | まず**名古屋市会**のみ。全国対応は将来、`Connector`（自治体別アダプター）で拡張する想定 |
| 対象年度 | **2025 年（令和 7 年）**の定例会など。2026 年は議事録が未整備の可能性があるため MVP 外でもよい |

---

## 2. 参照 URL（名古屋市）

| 用途 | URL |
|------|-----|
| 市議会 TOP | https://www.city.nagoya.jp/shikai/ |
| 議会情報 | https://www.city.nagoya.jp/shikai/about/1030648/1030652/index.html |
| 議案名・可決／否決 | https://www.city.nagoya.jp/shikai/shingi/1030858/index.html |
| 議事録（会議録検索） | https://ssp.kaigiroku.net/tenant/nagoya/SpTop.html |
| 議事録閲覧（2025 指定例） | https://ssp.kaigiroku.net/tenant/nagoya/SpMinuteBrowse.html?tenant_id=207&view_years=2025 |

---

## 3. アーキテクチャ方針（合意）

### 3.1 採用：**ハイブリッド C**

1. **主**: ルール・パターンマッチ・正規化した議案名による全文検索で、議案に関する**連続ブロック**を候補取得する  
2. **副**: 信頼度が低い・複数候補がある場合のみ、検索補助や境界判定に軽量手段（小モデル／必要最小限の API 等）を検討。**コストは極力抑える**  
3. 結果は必ず **`根拠（議事録 URL・可能なら位置情報）` と `引用全文` をセット**で保持する  

### 3.2 明示的に採用**しない**もの

- **NotebookLM の自動操作**など、非公式 UI 操作に依存するパイプライン（壊れやすい・再現性・規約面で本線に不向き）  
- MVP 初期段階での**永続 DB**および**PDF 生成**（必須ではない。後から追加可能）  

### 3.3 論理コンポーネント（目安）

| コンポーネント | 役割 |
|----------------|------|
| **Connector（自治体別）** | 議案一覧・議事録の取得。HTML／PDF の差異を吸収し、**正規化テキスト＋出典メタ**を返す |
| **正規化** | 議案名の表記ゆれ（全角半角、スペース、「について」等） |
| **抽出パイプライン** | ルール段階 → 必要ならフォールバック段階 |
| **成果物** | 1 議案 1 JSON ファイル（下記） |

---

## 4. 議事録の取得形式（調査メモ）

- `ssp.kaigiroku.net` の閲覧ページは、**初期 HTML は枠のみ**で、会議一覧・本文は **JavaScript により後から読み込む**構成であることが静的取得で確認できた  
- そのため **curl の HTML だけでは「本文が常に HTML か常に PDF か」は断定できない**  
- **コネクタ設計の推奨**: 実行時に判定する  
  - **第一**: HTML（または API／XHR 応答）からテキスト化  
  - **第二**: PDF（テキストレイヤ優先、スキャンのみなら OCR を別タスクで検討）  
- 実装フェーズでは、**2025 本会議など 1 件をヘッドレスブラウザで開き**、Network で実レスポンスの MIME／URL をキャプチャして名古屋向けのデフォルトを固める  

---

## 5. データ保存方針（MVP）

### 5.1 1 議案 1 ファイル（JSON）

- 名古屋では **1 定例会で 100 件超**の議案があり、**1 会期 1 ファイル**は肥大化しやすい  
- **1 議案あたり 1 JSON ファイル**とし、Git 差分・再実行・人手確認の単位を小さく保つ  
- 後から DB に載せる場合は、**ディレクトリ単位の一括インポート**で移行可能  

### 5.2 ディレクトリ構成の例（案）

```
data/nagoya/<西暦年>/<会議種別>/<第N回など>/<bill_key>/bill.json
```

- ファイル名は `bill.json` に固定し、**識別子は JSON 内の `bill.bill_key`** に持たせると、ファイル名の OS 制限・文字種の問題を避けやすい  
- 人間向けに議案名をパスに含める場合は、**短い略号＋番号**などに留める  

---

## 6. JSON スキーマ案（ドラフト）

1 ファイル＝1 議案。フィールド名は実装時に `schema_version` で互換管理する。

### 6.1 ルート

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `schema_version` | string | ○ | 例: `"1.0.0"` |
| `municipality` | object | ○ | 例: `{ "id": "nagoya", "name": "名古屋市" }` |
| `legislature` | object | ○ | 例: `{ "body": "city_council", "name": "名古屋市会" }` |
| `session` | object | ○ | 会期・会議（下表） |
| `bill` | object | ○ | 議案識別・名称・表決（下表） |
| `sources` | object | ○ | 取得元 URL 等（下表） |
| `bill_content` | object | ○ | 全文引用本体（下表） |
| `extraction` | object | ○ | 抽出方法・信頼度（下表） |
| `notes` | string | × | 人間向けメモ |

### 6.2 `session`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `era_name` | string | 例: `"令和"` |
| `era_year` | integer | 和暦年（例: 7） |
| `calendar_year` | integer | 西暦（例: 2025） |
| `session_type` | string | 例: `"regular"`（定例会） |
| `session_number` | integer \| null | 第○回定例会の○ |
| `session_label` | string | サイト表記のそのまま（表示用） |

### 6.3 `bill`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `bill_key` | string | ファイル間で一意（例: `nagoya-2025-regular-03-047`） |
| `bill_number` | string \| null | 第○○号議案など |
| `title` | string | 正規化した議案名 |
| `title_raw` | string | 一覧サイトの原文 |
| `decision` | string \| null | 例: `"approved"`, `"rejected"`, `"withdrawn"`, `"unknown"` |
| `decision_raw` | string \| null | 表決の原文 |

### 6.4 `sources`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `bill_index` | object | `url`, `fetched_at`（ISO8601） |
| `minutes` | array | 根拠となった議事録。要素は下表 |

**`sources.minutes[]`**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `url` | string | 会議録ページ URL |
| `fetched_at` | string | ISO8601 |
| `delivery` | string | `"html"` \| `"pdf"` \| `"unknown"` |
| `label` | string | 例: 本会議／委員会名 |
| `meeting_date` | string \| null | 例: `"2025-03-15"` |

### 6.5 `bill_content`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `text` | string | 議事録からの**全文引用**（改行は `\n`） |
| `is_complete` | boolean | 一連のブロックとして取れたかの自己判断 |
| `spans` | array | 出典の細かい位置（任意・推奨）。要素は下表 |

**`bill_content.spans[]`（HTML 時の例）**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `source_url` | string | `sources.minutes` と対応 |
| `selector_hint` | string \| null | アンカー id 等（不安定なら参考程度） |
| `start_offset` | integer \| null | 抽出後 `text` 内の文字オフセット |
| `end_offset` | integer \| null | 同上 |
| `before_hash` | string \| null | 検証用 |
| `after_hash` | string \| null | 検証用 |

PDF の場合は `page_start` / `page_end` 等を `spans` に追加する拡張でよい。

### 6.6 `extraction`

| フィールド | 型 | 説明 |
|------------|-----|------|
| `pipeline` | string | 例: `"hybrid_c_v1"` |
| `rule_stage` | object | `applied`, `matched_patterns[]` 等 |
| `fallback_stage` | object | 未使用なら `used: false` |
| `confidence` | number または string | 0–1 または `"high"` 等 |
| `warnings` | string[] | 例: 複数候補あり |

---

## 7. 非機能・リスク（実装時に確認）

- **利用規約・著作権**: 自動取得の範囲、キャッシュ、再配布の可否は市サイトおよび議事録サービス側の条件を確認する  
- **サイト変更**: Connector を薄くし、**フィクスチャによる回帰テスト**で変更に気づきやすくする  
- **表記ゆれ**: 議案名と議事録見出しの不一致は正規化と候補スコアで扱う  

---

## 8. 実装後の改善方針（合意）

- 大枠は固まった前提で、**実装しながらスキーマ・ルール・ Connector を適宜改善**する  
- スキーマ変更時は `schema_version` を上げ、必要なら移行スクリプトを別途用意する  

---

## 9. 次のアクション（実装フェーズ向けチェックリスト）

1. 議案一覧ページの HTML 構造を確認し、**議案 ID・表決・議案名**の取得方法を確定する  
2. 議事録（2025・本会議 1 件）で **実際の本文取得経路（HTML／XHR／PDF）** を確定する  
3. 数件の議案で**人手ラベル**（正しい引用範囲）を作り、ルール段階の精度を測る  
4. `bill.json` の**サンプル 1 件**をリポジトリに置くか、生成コマンドの README を追記する（任意）  

以上が MVP 開発のたたき台資料である。更新したら本ファイルの更新履歴か Git ログで追う。
