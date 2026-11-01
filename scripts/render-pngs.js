// Draws every badge as a PNG into public/png/ (SPEC.md 6). There are only
// 48 badges (3 labels x 4 styles x 2 sizes x 2 variants) plus 8 neutral ones,
// so the PNGs are made once here instead of converting on each request.
// Run after changing the badge drawing or adding a mascot:
//   node scripts/render-pngs.js
// Needs Chrome; set CHROME_PATH if it is not in the default macOS place.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { LABEL_SLUGS, SIZES, STYLES, VARIANTS, badge, neutralBadge } from "../src/badge.js";

export const OUT = new URL("../public/png/", import.meta.url);
export const pngName = (label, style, size, variant) => `${label}-${style}-${size}-${variant}.png`;
export const neutralName = (style, size) => `neutral-${style}-${size}.png`;

const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCALE = 2; // sharp on high-density screens; width and height attributes keep the display size

async function main() {
  mkdirSync(OUT, { recursive: true });
  const font = readFileSync(new URL("../public/fonts/InterVariable.woff2", import.meta.url)).toString("base64");
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ deviceScaleFactor: SCALE });
  const jobs = [];
  for (const label of LABEL_SLUGS)
    for (const style of STYLES)
      for (const size of SIZES)
        for (const variant of VARIANTS) jobs.push([pngName(label, style, size, variant), badge(size, style, label, variant)]);
  for (const style of STYLES) for (const size of SIZES) jobs.push([neutralName(style, size), neutralBadge(size, style)]);

  for (const [name, svg] of jobs) {
    await page.setContent(
      `<style>@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format("woff2")}` +
        `html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const png = await (await page.$("svg")).screenshot({ omitBackground: true });
    writeFileSync(new URL(name, OUT), png);
  }
  await browser.close();
  console.log(`wrote ${jobs.length} PNGs to public/png/`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
