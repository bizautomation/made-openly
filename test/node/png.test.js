import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LABEL_SLUGS, SIZES, STYLES, VARIANTS, DIMENSIONS } from "../../src/badge.js";

const dir = new URL("../../public/png/", import.meta.url);
const size = (file) => {
  const b = readFileSync(new URL(file, dir));
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe("pre-drawn PNG badges (scripts/render-pngs.js)", () => {
  it("exist for every badge and every neutral badge, at 2x", () => {
    const want = [];
    for (const l of LABEL_SLUGS) for (const st of STYLES) for (const z of SIZES) for (const v of VARIANTS) want.push([`${l}-${st}-${z}-${v}.png`, z]);
    for (const st of STYLES) for (const z of SIZES) want.push([`neutral-${st}-${z}.png`, z]);
    for (const [file, z] of want) {
      expect(existsSync(new URL(file, dir)), file).toBe(true);
      expect(size(file)).toEqual(DIMENSIONS[z].map((n) => n * 2));
    }
    expect(readdirSync(dir).filter((f) => f.endsWith(".png")).sort()).toEqual(want.map(([f]) => f).sort());
  });
});
