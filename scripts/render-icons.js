// Draws the site icons from the robot mascot (SPEC.md 11.4): favicon.svg,
// favicon.ico (32 and 48 px), apple-touch-icon.png (180 px, on the paper
// colour, since iOS fills transparency with black) and icon-512.png (the
// logo in structured data). Google needs a square favicon.
// Run after changing the robot mascot:
//   node scripts/render-icons.js
// Needs Chrome; set CHROME_PATH if it is not in the default macOS place.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const PUBLIC = new URL("../public/", import.meta.url);
const ROBOT = new URL("../mascots/robot.svg", import.meta.url);
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAPER = "#FAF8F5";

// An ICO file holding PNG images, which every current browser reads.
export function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); // colour planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

async function main() {
  copyFileSync(ROBOT, new URL("favicon.svg", PUBLIC));
  const svg = readFileSync(ROBOT, "utf8");
  const browser = await chromium.launch({ executablePath: CHROME });
  // A fresh page per size: resizing one page left parts of the last drawing.
  const draw = async (size, background, pad = 0) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = size - 2 * pad;
    await page.setContent(
      `<style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden;background:${background}}` +
        `body{display:flex;align-items:center;justify-content:center}` +
        `svg{display:block;flex:none;width:${inner}px;height:${inner}px}</style>${svg}`,
    );
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size }, omitBackground: background === "transparent" });
    await page.close();
    return png;
  };
  const png32 = await draw(32, "transparent");
  const png48 = await draw(48, "transparent");
  writeFileSync(new URL("favicon.ico", PUBLIC), ico([{ size: 32, data: png32 }, { size: 48, data: png48 }]));
  writeFileSync(new URL("apple-touch-icon.png", PUBLIC), await draw(180, PAPER, 18));
  writeFileSync(new URL("icon-512.png", PUBLIC), await draw(512, PAPER, 51));
  await browser.close();
  console.log("wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-512.png");
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
