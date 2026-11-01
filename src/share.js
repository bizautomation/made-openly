// Link previews and search (SPEC.md 11.4): Open Graph and card tags, the
// canonical address, and the sitemap. Static tags only; nothing reads visitors.

export const ORIGIN = "https://madeopenly.com";
const DESCRIPTION =
  "A free badge that says how much AI helped make your work. Three labels: Mostly AI, Human + AI, Human only. We count places, never visitors.";
const IMAGE = { url: `${ORIGIN}/og.png`, width: 1200, height: 630, alt: "Three Made Openly badges: Mostly AI, Human + AI, Human only." };

export const HOME = {
  url: `${ORIGIN}/`,
  title: "Made Openly: say how much AI helped make your work",
  description: DESCRIPTION,
  // WebSite and Organization structured data, on the home page only.
  jsonLd: {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${ORIGIN}/#website`, name: "Made Openly", url: `${ORIGIN}/`, description: DESCRIPTION, publisher: { "@id": `${ORIGIN}/#organization` } },
      {
        "@type": "Organization",
        "@id": `${ORIGIN}/#organization`,
        name: "Made Openly",
        url: `${ORIGIN}/`,
        logo: `${ORIGIN}/icon-512.png`,
        sameAs: ["https://github.com/bizautomation/made-openly"],
        parentOrganization: { "@type": "Organization", name: "Biz-Automation Co., Ltd.", address: { "@type": "PostalAddress", addressLocality: "Bangkok", addressCountry: "TH" } },
      },
    ],
  },
};
export const PLACES = {
  url: `${ORIGIN}/places`,
  title: "Places wearing Made Openly",
  description: "Sites, repos, posts and products that wear the Made Openly badge and asked to be named. We count places, never visitors.",
};

// The pages search engines may list. Not /manage, /stats.json or any badge or API address.
const SITEMAP_PAGES = [HOME, PLACES];

const attr = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

// The head tags for one page. The canonical never carries a query string,
// so /?t=TOKEN badge-link visits point back to /.
export function headTags({ url, title, description, jsonLd }) {
  const meta = (key, name, content) => `<meta ${key}="${name}" content="${attr(String(content))}">`;
  const tags = [
    meta("name", "description", description),
    `<link rel="canonical" href="${attr(url)}">`,
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", "Made Openly"),
    meta("property", "og:url", url),
    meta("property", "og:title", title),
    meta("property", "og:description", description),
    meta("property", "og:image", IMAGE.url),
    meta("property", "og:image:width", IMAGE.width),
    meta("property", "og:image:height", IMAGE.height),
    meta("property", "og:image:alt", IMAGE.alt),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", title),
    meta("name", "twitter:description", description),
    meta("name", "twitter:image", IMAGE.url),
    meta("name", "twitter:image:alt", IMAGE.alt),
  ];
  if (jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>`);
  return tags.join("\n");
}

export function sitemap() {
  const urls = SITEMAP_PAGES.map((p) => `  <url><loc>${p.url}</loc></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}

// robots.txt is Cloudflare's managed file (content signals), set on the
// zone. A robots.txt from the Worker replaces it rather than adding to it, so
// the Worker serves none and the sitemap is submitted in Search Console.

// GET /og.png: the share image, drawn once by scripts/render-og.js.
export async function shareImage(env) {
  const res = await env.ASSETS.fetch(new Request(`${ORIGIN}/og.png`));
  if (!res.ok) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800", "X-Content-Type-Options": "nosniff" },
  });
}
