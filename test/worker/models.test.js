import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

describe("GET /music/models, the model fit review", () => {
  it("is a page of its own, with the site's menu and a canonical address", async () => {
    const res = await call("/music/models");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Set-Cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="https://madeopenly.com/music/models">');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(nav).toContain('<a href="/music">Music</a>');
    expect(nav).toContain('<a href="/music/models" aria-current="page">Model review</a>');
    expect(html).toContain('<p class="crumb"><a href="/music">Music</a>');
  });

  it("says near the top that these are one project's findings, not benchmarks", async () => {
    const html = await (await call("/music/models")).text();
    const disclaimer = html.indexOf('<aside class="disclaimer"');
    expect(disclaimer).toBeGreaterThan(0);
    expect(disclaimer).toBeLessThan(html.indexOf('<section id="quick">'));
    const text = html.slice(disclaimer, html.indexOf("</aside>", disclaimer));
    expect(text).toContain("one person's experience on one music-video project");
    expect(text).toContain("between 7 and 24 November 2026");
    expect(text).toContain("They are not benchmarks");
    expect(text).toContain("check the current price with the provider before running anything");
  });

  it("uses plain words for each assessment, never the old shorthand", async () => {
    const html = await (await call("/music/models")).text();
    const body = html.slice(html.indexOf("<main"), html.indexOf("</main>")).replace(/<[^>]+>/g, " ");
    for (const word of ["Recommended", "Mixed results", "Not recommended"]) expect(body).toContain(word);
    expect(body).not.toMatch(/\b(USE|TEST|NO)\b/);
    expect(body).not.toMatch(/\bcr\b/); // credits, written out
  });

  it("keeps the prices and measurements of the source notes", async () => {
    const html = await (await call("/music/models")).text();
    for (const fact of ["163 findings", "2816 × 1584", "$0.0675 per image", "0.665 to 0.704", "about 3.1 times the list price", "227 of 646 frames", "$0.0072 per second", "12 + 60 = 72 credits", "276 against 250", "0.15–0.34 s"])
      expect(html).toContain(fact);
    for (const id of ["quick", "stills", "warm-face", "video", "upscalers", "local", "prompts", "billing", "open"]) {
      expect(html).toContain(`<section id="${id}">`);
      expect(html).toContain(`href="#${id}"`);
    }
  });

  it("points to the methods page, which has its own address", async () => {
    const html = await (await call("/music/models")).text();
    const text = html.slice(html.indexOf('<section id="methods">'), html.indexOf('<section id="billing">'));
    expect(text).toContain('<a class="more" href="/music/methods">Read the eight methods</a>');
    expect(text).not.toContain("<img");
    // One picture on this page: the light flood take under LTX 2.3.
    const imgs = html.slice(html.indexOf("<main"), html.indexOf("</main>")).match(/<img [^>]*>/g);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain('src="/art/tricks/ltx-light-800.jpg"');
    expect(imgs[0]).toMatch(/ width="1600" height="902" alt="[^"]{40,}" loading="lazy"/);
    expect(html.indexOf("ltx-light-800.jpg")).toBeGreaterThan(html.indexOf('id="m4-9"'));
    expect(html).toContain('<nav class="tabs" aria-label="Model review"><a href="/music/models" aria-current="page">Models and prices</a><a href="/music/methods">Methods</a></nav>');
  });

  it("links each row of the summary to its detail, and lists the models under their sections", async () => {
    const html = await (await call("/music/models")).text();
    const quick = html.slice(html.indexOf('<section id="quick">'), html.indexOf('<section id="stills">'));
    const hrefs = [...quick.matchAll(/<td><a href="(#[^"]+)">/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(15);
    for (const href of hrefs) expect(html).toContain(` id="${href.slice(1)}"`);
    const side = html.slice(html.indexOf('<aside class="toc-side">'), html.indexOf("</aside>", html.indexOf('<aside class="toc-side">')));
    expect(side).toContain('<a href="#m2-1">GPT Image 2.5 Flare</a>');
    expect(side).toContain('<a href="#m4-9">LTX 2.3</a>');
    expect(html).toContain('<details class="toc-m"><summary>On this page</summary>');
    expect(html.match(/<p class="top"><a href="#top">Back to top<\/a><\/p>/g)).toHaveLength(10);
  });

  it("redirects a trailing slash to the page", async () => {
    const res = await call("/music/models/", { redirect: "manual" });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://madeopenly.com/music/models");
  });
});
