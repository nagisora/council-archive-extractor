/**
 * kaigiroku（名古屋テナント）閲覧ページで発生するレスポンスを収集し、
 * 議事録本文の取得経路（HTML / JSON / PDF 等）の手がかりを標準出力に出す。
 *
 * Usage: pnpm exec node tools/capture-kaigiroku-network.mjs
 */
import { chromium } from "playwright";

const START_URL =
  "https://ssp.kaigiroku.net/tenant/nagoya/SpMinuteBrowse.html?tenant_id=207&view_years=2025";

function summarize(headers) {
  return {
    "content-type": headers["content-type"] ?? headers["Content-Type"] ?? "",
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    userAgent:
      "Mozilla/5.0 (compatible; council-archive-extractor/0.1; +https://github.com/nagisora/council-archive-extractor)",
  });
  const page = await context.newPage();

  /** @type {import('playwright').Response[]} */
  const responses = [];

  page.on("response", (res) => {
    try {
      const url = res.url();
      if (!url.includes("kaigiroku") && !url.includes("ssp.")) {
        return;
      }
      responses.push(res);
    } catch {
      // ignore
    }
  });

  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(8000);

  /** @type {Map<string, { url: string; status: number; contentType: string; bodyBytes: number | null }>} */
  const byUrl = new Map();

  for (const res of responses) {
    const url = res.url();
    const status = res.status();
    const contentType = summarize(res.headers())["content-type"];
    let bodyBytes = null;
    try {
      const buf = await res.body();
      bodyBytes = buf.length;
    } catch {
      bodyBytes = null;
    }
    const key = `${status}\t${contentType}\t${url}`;
    if (!byUrl.has(key)) {
      byUrl.set(key, { url, status, contentType, bodyBytes });
    }
  }

  const rows = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));

  console.log(JSON.stringify({ startUrl: START_URL, capturedCount: rows.length }, null, 2));
  for (const row of rows) {
    console.log(
      JSON.stringify({
        status: row.status,
        contentType: row.contentType,
        bodyBytes: row.bodyBytes,
        url: row.url,
      }),
    );
  }

  const domLen = (await page.content()).length;
  console.log(JSON.stringify({ domHtmlLength: domLen, finalUrl: page.url() }));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
