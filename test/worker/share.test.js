import { describe, expect, it } from "vitest";
import { call } from "./helpers.js";

const DESCRIPTION =
  "A free badge that says how much AI helped make your work. Three labels: Mostly AI, Human + AI, Human only. We count places, never visitors.";
const ALT = "Three Made Openly badges: Mostly AI, Human + AI, Human only.";

const head = async (path) => {
  const html = await (await call(path)).text();
  return html.slice(0, html.indexOf("</head>"));
};
const meta = (h, key, name) => new RegExp(`<meta ${key}="${name.replace(/[.+]/g, "\\$&")}" content="([^"]*)">`).exec(h)?.[1];
const canonical = (h) => /<link rel="canonical" href="([^"]*)">/.exec(h)?.[1];
const unesc = (s) => s?.replaceAll("&amp;", "&").replaceAll("&quot;", '"');

describe("share tags (SPEC.md 11.4)", () => {
  it("are all on /, with the WebSite JSON-LD", async () => {
    const h = await head("/");
    expect(canonical(h)).toBe("https://madeopenly.com/");
    expect(unesc(meta(h, "name", "description"))).toBe(DESCRIPTION);
    expect(meta(h, "property", "og:type")).toBe("website");
    expect(meta(h, "property", "og:site_name")).toBe("Made Openly");
    expect(meta(h, "property", "og:url")).toBe("https://madeopenly.com/");
    expect(meta(h, "property", "og:title")).toBe("Made Openly: say how much AI helped make your work");
    expect(unesc(meta(h, "property", "og:description"))).toBe(DESCRIPTION);
    expect(meta(h, "property", "og:image")).toBe("https://madeopenly.com/og.png");
    expect(meta(h, "property", "og:image:width")).toBe("1200");
    expect(meta(h, "property", "og:image:height")).toBe("630");
    expect(unesc(meta(h, "property", "og:image:alt"))).toBe(ALT);
    expect(meta(h, "name", "twitter:card")).toBe("summary_large_image");
    expect(meta(h, "name", "twitter:title")).toBe("Made Openly: say how much AI helped make your work");
    expect(unesc(meta(h, "name", "twitter:description"))).toBe(DESCRIPTION);
    expect(meta(h, "name", "twitter:image")).toBe("https://madeopenly.com/og.png");
    expect(unesc(meta(h, "name", "twitter:image:alt"))).toBe(ALT);
    expect(h.match(/<meta name="description"/g)).toHaveLength(1);
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(h)[1]);
    expect(ld).toEqual({ "@context": "https://schema.org", "@type": "WebSite", name: "Made Openly", url: "https://madeopenly.com/", description: DESCRIPTION });
  });

  it("canonical ignores the query string, so badge-link visits point back to /", async () => {
    const h = await head("/?t=0123456789abcdef0123&utm_source=x");
    expect(canonical(h)).toBe("https://madeopenly.com/");
    expect(meta(h, "property", "og:url")).toBe("https://madeopenly.com/");
  });

  it("fit /places, with the same image and no JSON-LD", async () => {
    const h = await head("/places?l=mostly-ai&p=2");
    expect(h).toContain("<title>Places wearing Made Openly</title>");
    expect(canonical(h)).toBe("https://madeopenly.com/places");
    expect(meta(h, "property", "og:url")).toBe("https://madeopenly.com/places");
    expect(meta(h, "property", "og:title")).toBe("Places wearing Made Openly");
    expect(meta(h, "name", "twitter:title")).toBe("Places wearing Made Openly");
    expect(meta(h, "name", "description")).toMatch(/asked to be named/);
    expect(meta(h, "property", "og:image")).toBe("https://madeopenly.com/og.png");
    expect(meta(h, "name", "twitter:card")).toBe("summary_large_image");
    expect(h).not.toContain("application/ld+json");
  });

  it("stay off /manage, which is noindex", async () => {
    const h = await head("/manage");
    expect(h).toContain('<meta name="robots" content="noindex">');
    expect(h).not.toMatch(/og:|twitter:|rel="canonical"|__HEAD_TAGS__/);
  });
});

describe("GET /og.png", () => {
  it("is the 1200 x 630 PNG share image with a long cache", async () => {
    const res = await call("/og.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=604800");
    const b = new Uint8Array(await res.arrayBuffer());
    const view = new DataView(b.buffer);
    expect(String.fromCharCode(...b.subarray(1, 4))).toBe("PNG");
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
    expect(b.length).toBeLessThan(300 * 1024);
  });
});

describe("GET /sitemap.xml", () => {
  it("lists / and /places only, as XML", async () => {
    const res = await call("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])).toEqual(["https://madeopenly.com/", "https://madeopenly.com/places"]);
  });
});

describe("GET /robots.txt", () => {
  it("names the sitemap on madeopenly.com", async () => {
    const res = await call("/robots.txt");
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Sitemap: https://madeopenly.com/sitemap.xml\n");
  });
});
