/**
 * fixtures/golden-labels/*.golden.json に定義した必須部分文字列が、
 * 抽出結果テキスト（コーパス）にすべて含まれるかを検証する。
 *
 * Usage:
 *   pnpm exec node tools/evaluate-golden.mjs path/to/corpus.txt
 *   CORPUS_FILE=path/to/corpus.txt pnpm run eval:golden
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const GOLDEN_DIR = path.join(ROOT, "fixtures", "golden-labels");

function loadGoldenFiles() {
  const names = fs.readdirSync(GOLDEN_DIR);
  return names
    .filter((n) => n.endsWith(".golden.json"))
    .map((n) => {
      const full = path.join(GOLDEN_DIR, n);
      const raw = fs.readFileSync(full, "utf8");
      return { file: n, data: JSON.parse(raw) };
    });
}

function main() {
  const corpusPath = process.argv[2] || process.env.CORPUS_FILE;
  if (!corpusPath) {
    console.error(
      "コーパス（抽出結果のプレーンテキスト）へのパスを指定してください。\n例: pnpm exec node tools/evaluate-golden.mjs ./out/corpus.txt",
    );
    process.exit(2);
  }
  if (!fs.existsSync(corpusPath)) {
    console.error(`ファイルが見つかりません: ${corpusPath}`);
    process.exit(1);
  }

  const corpus = fs.readFileSync(corpusPath, "utf8");
  const goldens = loadGoldenFiles();
  if (goldens.length === 0) {
    console.error(`ゴールデンファイルが見つかりません: ${GOLDEN_DIR}`);
    process.exit(1);
  }

  let failed = 0;
  for (const { file, data } of goldens) {
    const id = data.bill_key || file;
    const must = data.evaluation?.gold_must_contain_all;
    if (!Array.isArray(must) || must.length === 0) {
      console.log(`[SKIP] ${id} gold_must_contain_all が空です`);
      continue;
    }
    const missing = must.filter((s) => !corpus.includes(s));
    if (missing.length) {
      failed += 1;
      console.log(`[FAIL] ${id}`);
      for (const m of missing) {
        console.log(`  欠落: ${JSON.stringify(m)}`);
      }
    } else {
      console.log(`[OK]   ${id}`);
    }
  }

  if (failed) {
    console.error(`\n失敗: ${failed} / ${goldens.length}`);
    process.exit(1);
  }
  console.log(`\n成功: ${goldens.length} 件`);
}

main();
