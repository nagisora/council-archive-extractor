/**
 * 令和7年11月定例会（市長提出案件）について、
 * 市サイトから議案を5件取得し、kaigiroku 本会議の会議録から市長提案説明の該当段落を抽出する統合テスト。
 *
 * Usage:
 *   pnpm exec playwright install chromium   # 初回のみ
 *   pnpm run test:integration:r7-202511
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const CITY_BILLS_URL =
  "https://www.city.nagoya.jp/shikai/shingi/1030858/1030859/1043121.html";
const TENANT_ID = 207;
const COUNCIL_ID = 660;
const VIEW_YEARS = 2025;
/** 11月17日－22号（目次・開会・市長一括提案説明が含まれる） */
const SCHEDULE_ID = 2;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function stripJsonp(text) {
  const m = text.match(/^[^(]+\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) {
    throw new Error("JSONP のパースに失敗しました");
  }
  return JSON.parse(m[1]);
}

function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n");
}

async function fetchCityBillsFirstN(n) {
  const res = await fetch(CITY_BILLS_URL, {
    headers: {
      "user-agent": "council-archive-extractor/0.1 (+https://github.com/nagisora/council-archive-extractor)",
      "accept-language": "ja,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`市の議案一覧の取得に失敗しました: HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = load(html);
  const rows = [];
  $("table tbody tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .toArray()
      .map((td) =>
        $(td)
          .text()
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    if (cells.length < 2) {
      return;
    }
    const rawNum = cells[0].replace(/^第/, "").replace(/号$/, "").trim();
    if (!/^\d+$/.test(rawNum)) {
      return;
    }
    const title = cells[1];
    const decisionRaw = cells[5] ?? "";
    rows.push({
      bill_number: rawNum,
      bill_number_display: `第${rawNum}号`,
      title,
      decision_raw: decisionRaw,
    });
  });
  return rows.slice(0, n);
}

async function fetchKaigirokuMinutePlainText({ tenantId, councilId, scheduleId, viewYears }) {
  const viewUrl = `https://ssp.kaigiroku.net/tenant/nagoya/SpMinuteView.html?power_user=false&tenant_id=${tenantId}&council_id=${councilId}&schedule_id=${scheduleId}&view_years=${viewYears}`;
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: "ja-JP", userAgent: USER_AGENT });
  const page = await ctx.newPage();
  const resP = page.waitForResponse(
    (r) => r.url().includes("/dnp/search/minutes/get_minute") && r.status() === 200,
    { timeout: 120_000 },
  );
  await page.goto(viewUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const res = await resP;
  const data = stripJsonp(await res.text());
  let full = "";
  for (const m of data.tenant_minutes) {
    full += "\n\n" + htmlToPlainText(m.body ?? "");
  }
  await browser.close();
  return { viewUrl, plainText: full.trim() };
}

function extractMayorProposalSnippets(plainText, billNumbers) {
  const mayorIdx = plainText.indexOf("◎市長");
  const startSearch = mayorIdx === -1 ? 0 : mayorIdx;
  const sub = plainText.slice(startSearch);
  const snippets = [];
  for (let i = 0; i < billNumbers.length; i++) {
    const n = billNumbers[i];
    const startKey = `第${n}号議案「`;
    const start = sub.indexOf(startKey);
    if (start === -1) {
      throw new Error(`市長提案説明内に ${startKey} が見つかりませんでした`);
    }
    let end = sub.length;
    const boundaryRe = /　次に、第\d+号議案「|　続きまして、第\d+号議案「/;
    const boundary = boundaryRe.exec(sub.slice(start + 1));
    if (boundary) {
      end = start + 1 + boundary.index;
    }
    for (let j = i + 1; j < billNumbers.length; j++) {
      const nn = billNumbers[j];
      const nextKey = `第${nn}号議案「`;
      const nextIdx = sub.indexOf(nextKey, start + 1);
      if (nextIdx !== -1 && nextIdx < end) {
        end = nextIdx;
      }
    }
    snippets.push(sub.slice(start, end).trim());
  }
  return snippets;
}

async function main() {
  const bills = await fetchCityBillsFirstN(5);
  if (bills.length < 5) {
    throw new Error(`議案が5件未満でした: ${bills.length} 件`);
  }
  const { viewUrl, plainText } = await fetchKaigirokuMinutePlainText({
    tenantId: TENANT_ID,
    councilId: COUNCIL_ID,
    scheduleId: SCHEDULE_ID,
    viewYears: VIEW_YEARS,
  });
  const nums = bills.map((b) => b.bill_number);
  const contents = extractMayorProposalSnippets(plainText, nums);

  const result = {
    schema_version: "integration-test-1",
    session_label: "令和7年11月定例会（市長提出案件・本会議）",
    sources: {
      bill_index_url: CITY_BILLS_URL,
      minutes_view_url: viewUrl,
      minutes_schedule_id: SCHEDULE_ID,
      council_id: COUNCIL_ID,
    },
    bills: bills.map((b, i) => ({
      bill_number: b.bill_number_display,
      title: b.title,
      decision_raw: b.decision_raw,
      bill_content_text: contents[i],
    })),
  };

  const outDir = path.join(ROOT, "test-results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "r7-202511-five-bills.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

  console.log(JSON.stringify({ ok: true, wrote: outPath, count: result.bills.length }, null, 2));
  for (const row of result.bills) {
    console.log(
      JSON.stringify({
        bill_number: row.bill_number,
        title: row.title,
        content_chars: row.bill_content_text.length,
        content_preview: row.bill_content_text.slice(0, 120).replace(/\n/g, " "),
      }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
