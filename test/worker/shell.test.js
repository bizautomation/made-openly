import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

// The header and footer every page shares (SPEC.md 11, Style).
describe("the site header and footer", () => {
  const headerOf = (html) => html.slice(html.indexOf('<header class="site">'), html.indexOf("</header>"));

  it("keeps the header on screen, with the brand, the links and a Get a badge button", async () => {
    const html = await (await call("/")).text();
    expect(html).toMatch(/\.site\{position:sticky;top:0/);
    const header = headerOf(html);
    expect([...header.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1])).toEqual(["#labels", "#count", "#faq", "/places", "/music", "/music/models"]);
    expect(header).toContain('<a class="btn cta" href="#get">Get a badge</a>');
    // Every on-page link lands on a section of the home page.
    for (const id of ["top", "labels", "count", "faq", "get"]) expect(html.match(new RegExp(` id="${id}"`, "g"))).toHaveLength(1);
  });

  it("folds the links behind a Menu button on a phone, without script", async () => {
    const header = headerOf(await (await call("/places")).text());
    expect(header).toContain('<input class="menu-toggle" type="checkbox" id="menu-toggle" aria-label="Menu">');
    expect(header).toContain('<label class="menu-btn" for="menu-toggle"');
  });

  it.each([["/places", "/places"], ["/music/models", "/music/models"]])("marks %s as the current page, and only that link", async (path, href) => {
    const header = headerOf(await (await call(path)).text());
    expect(header.match(/aria-current="page"/g)).toHaveLength(1);
    expect(header).toContain(`<a href="${href}" aria-current="page">`);
    // Away from the home page, on-page links point back to it.
    expect(header).toContain('<a href="/#labels">Labels</a>');
    expect(header).toContain('<a class="btn cta" href="/#get">Get a badge</a>');
  });

  it("marks no link as current on the home page, the privacy page or the manage page", async () => {
    for (const path of ["/", "/privacy", "/manage"]) expect(headerOf(await (await call(path)).text())).not.toContain("aria-current");
  });

  it("lists every page in the footer", async () => {
    const html = await (await call("/privacy")).text();
    const footer = html.slice(html.indexOf('<footer id="privacy">'), html.indexOf("</footer>"));
    for (const href of ["/#labels", "/#get", "/manage", "/#count", "/places", "/music", "/music/models", "/#faq", "/privacy", "/#contact", "https://github.com/bizautomation/made-openly", "https://crayonraven.com"]) expect(footer).toContain(`<a href="${href}">`);
  });

  it("shows the Crayon Raven logo beside the site's own badge, linked to the band's page", async () => {
    for (const path of ["/", "/places", "/privacy", "/music/models", "/music/methods"]) {
      const html = await (await call(path)).text();
      const footer = html.slice(html.indexOf('<footer id="privacy">'), html.indexOf("</footer>"));
      const logos = footer.slice(footer.indexOf('<div class="foot-logos">'), footer.indexOf("</div>", footer.indexOf('<div class="foot-logos">')));
      expect(logos).toContain('<a class="own"');
      expect(logos).toContain('<a class="cr" href="https://crayonraven.com" title="Crayon Raven, the band behind the music"><img src="/crayon-raven-logo.png" width="62" height="44" alt="Crayon Raven"');
    }
  });
});
