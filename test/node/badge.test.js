import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import * as port from "../../src/badge.js";

// Evaluate the generator straight from reference/badges.html, stopping before
// the gallery code that touches the DOM.
const html = readFileSync(new URL("../../reference/badges.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];
const generator = script.split("const mascot=")[0];
const ref = runInNewContext(`${generator}\n;({ robot, badge, LABELS, STYLES })`, {});

describe("badge.js matches reference/badges.html", () => {
  it("draws the robot identically, light and dark", () => {
    expect(port.robot(false)).toBe(ref.robot(false));
    expect(port.robot(true)).toBe(ref.robot(true));
  });

  const combos = [];
  for (const size of ["small", "large"])
    for (const style of ref.STYLES)
      for (const [label] of ref.LABELS)
        for (const variant of ["robot", "wordmark"]) combos.push([size, style, label, variant]);

  it("covers 48 combinations", () => expect(combos).toHaveLength(48));

  it.each(combos)("badge(%s, %s, %s, %s)", (size, style, label, variant) => {
    expect(port.badge(size, style, label, variant)).toBe(ref.badge(size, style, label, variant));
  });
});

describe("mascots/robot.svg", () => {
  it("is the reference robot on a 0 0 100 100 viewBox", () => {
    const svg = readFileSync(new URL("../../mascots/robot.svg", import.meta.url), "utf8").trim();
    expect(svg).toBe(port.mascotSvg(false));
    expect(svg).toContain('viewBox="0 0 100 100"');
  });
});
