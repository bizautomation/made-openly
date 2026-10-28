import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMascots, checkSvg } from "../../scripts/check-mascots.js";

const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="c"><rect width="10" height="10"/></clipPath></defs><use href="#c"/><rect clip-path="url(#c)" width="1" height="1"/></svg>';

describe("checkSvg", () => {
  it("passes a clean mascot, including xmlns and internal references", () => {
    expect(checkSvg(ok)).toEqual([]);
  });

  it.each([
    ["a wrong viewBox", ok.replace("0 0 100 100", "0 0 24 24"), "viewBox"],
    ["a <script>", ok.replace("</svg>", "<script>alert(1)</script></svg>"), "<script>"],
    ["an event attribute", ok.replace("<rect ", '<rect onclick="x()" '), "event attribute"],
    ["an external href", ok.replace('href="#c"', 'href="https://evil.example/a.svg"'), "external href"],
    ["an external xlink:href", ok.replace('href="#c"', 'xlink:href="other.svg"'), "external href"],
    ["an external url()", ok.replace("url(#c)", "url(https://evil.example/x)"), "url()"],
    ["an <image>", ok.replace("</svg>", '<image href="#c"/></svg>'), "raster"],
    ["an embedded PNG", ok.replace("</svg>", "<!-- data:image/png;base64,AAAA --></svg>"), "raster"],
    ["over 10 KB", ok.replace("</svg>", `<!-- ${"x".repeat(10 * 1024)} --></svg>`), "10 KB"],
  ])("fails %s", (_, svg, expected) => {
    expect(checkSvg(svg).join(" | ")).toContain(expected);
  });
});

describe("checkMascots", () => {
  const entry = (slug) => ({ slug, name: "A", designer: "B", designer_url: "https://example.com", licence: "CC-BY-4.0" });
  const dir = (files, registry) => {
    const d = mkdtempSync(join(tmpdir(), "mascots-"));
    for (const [name, body] of Object.entries(files)) writeFileSync(join(d, name), body);
    writeFileSync(join(d, "registry.json"), JSON.stringify(registry));
    return d;
  };

  it("passes the repo's mascots", () => {
    expect(checkMascots(new URL("../../mascots", import.meta.url).pathname)).toEqual([]);
  });

  it("fails an SVG with no registry entry, and an entry with no SVG", () => {
    const problems = checkMascots(dir({ "cat.svg": ok }, [entry("dog")]));
    expect(problems).toContain("cat.svg: no entry in registry.json");
    expect(problems).toContain("registry.json: dog has no dog.svg");
  });

  it("fails a registry entry missing its designer or with another licence", () => {
    const problems = checkMascots(dir({ "cat.svg": ok }, [{ ...entry("cat"), designer: "", licence: "MIT" }]));
    expect(problems.join(" | ")).toContain("missing designer");
    expect(problems.join(" | ")).toContain("CC-BY-4.0");
  });
});
