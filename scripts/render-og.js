// Draws the share image public/og.png (1200 x 630) that link previews on
// LinkedIn, X, Facebook, Slack and LINE show (SPEC.md 11.4). Social sites do
// not render SVG, so it is a PNG drawn once here from the badge generator in
// reference/badges.html, so it always matches the live badges.
// Run after changing the badge drawing:
//   node scripts/render-og.js
// Needs Chrome; set CHROME_PATH if it is not in the default macOS place.
import { readFileSync, writeFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { chromium } from "playwright-core";

export const OG = new URL("../public/og.png", import.meta.url);
export const OG_SIZE = [1200, 630];

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LABELS = ["mostly-ai", "human-ai", "human-only"]; // top to bottom
const BADGE_WIDTH = 470; // scaled from 176 x 62
const GAP = 26;

// The generator from the reference, stopping before the gallery code that touches the DOM.
function referenceBadge() {
  const html = readFileSync(new URL("../reference/badges.html", import.meta.url), "utf8");
  const generator = html.split("<script>")[1].split("</script>")[0].split("const mascot=")[0];
  return runInNewContext(`${generator}\n;badge`, {});
}

async function main() {
  const badge = referenceBadge();
  const font = readFileSync(new URL("../public/fonts/InterVariable.woff2", import.meta.url)).toString("base64");
  const [width, height] = OG_SIZE;
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format("woff2")}` +
      `html,body{margin:0;width:${width}px;height:${height}px;background:#FAF8F5}` +
      `body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${GAP}px}` +
      `svg{display:block;width:${BADGE_WIDTH}px;height:auto;filter:drop-shadow(0 6px 18px rgba(31,41,55,.08))}</style>` +
      LABELS.map((label) => badge("large", "light", label, "robot")).join(""),
  );
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(OG, await page.screenshot({ clip: { x: 0, y: 0, width, height } }));
  await browser.close();
  console.log("wrote public/og.png");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
