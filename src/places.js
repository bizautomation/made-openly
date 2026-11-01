// GET /places (SPEC.md 10): every place that asked to be named, newest first,
// filtered by label and kind, 50 to a page. Rendered on the server so it works
// without script and can be read by search engines. Links carry
// rel="ugc nofollow": the list is user-submitted and must not sell backlinks.
import { LABEL_SLUGS, labelText } from "./badge.js";
import { KINDS, placeName, placeUrl, placesCte } from "./stats.js";
import { PLACES, headTags } from "./share.js";

export const PAGE_SIZE = 50;
const LABEL_ORDER = ["human-only", "human-ai", "mostly-ai"];
const LABEL_COLOR = { "human-only": "var(--human)", "human-ai": "var(--mid)", "mostly-ai": "var(--machine)" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmtDay = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export async function listPlaces(db, { label = null, kind = null, page = 1 } = {}) {
  const where = ["status = 'active'", "listed = 'yes'"];
  const binds = [];
  if (label) where.push("label = ?") && binds.push(label);
  if (kind) where.push("place_kind = ?") && binds.push(kind);
  // One row per place, even if it wears several badges.
  const cte = placesCte(where.join(" AND "));
  const { n: total } = await db.prepare(`${cte} SELECT COUNT(*) AS n FROM places`).bind(...binds).first();
  const { results } = await db
    .prepare(`${cte} SELECT host, declared_url, label, place_kind, first_verified FROM places ORDER BY first_verified DESC, token LIMIT ? OFFSET ?`)
    .bind(...binds, PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .all();
  return { total, rows: results };
}

const PLACES_CSS = `
.places-head{padding:40px 0 8px}
.places-head h1{margin:0 0 6px;font-size:32px;line-height:1.2}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 12px;font-size:14px;color:var(--ink);text-decoration:none}
.chip:hover{border-color:var(--machine);color:var(--machine)}
.chip[aria-current=true]{background:var(--machine-tint);border-color:var(--machine);color:var(--machine-deep);font-weight:600}
.rows{list-style:none;margin:24px 0 0;padding:0;border-top:1px solid var(--line)}
.rows li{display:grid;grid-template-columns:4px 1fr auto;gap:4px 14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.rows .swatch{grid-row:span 2;align-self:stretch;border-radius:2px}
.rows .name{font-weight:600;overflow-wrap:anywhere;text-decoration:none;color:var(--ink)}
.rows .name:hover{color:var(--machine)}
.rows .meta{grid-column:2;font-size:14px;color:var(--ink-soft)}
.rows .more{grid-column:3;grid-row:1 / span 2}
.more summary{border:0;padding:0;font-weight:400}
.more summary::after{content:"\\22EF";width:28px;height:28px;line-height:26px}
.more[open] summary::after{content:"\\22EF"}
.rows .more{border:0;padding:0;position:relative}
.more button{position:absolute;right:0;top:34px;z-index:1;white-space:nowrap;font:inherit;font-size:14px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 12px;color:var(--alert);cursor:pointer}
.empty{margin:24px 0 0}
.pager{margin:24px 0 0}
.ask{padding:32px 0 48px}
`;

// shell: { head, nav, footer } cut from page.html so both pages share one look.
export async function handlePlaces(env, url, shell, csp) {
  const p = url.searchParams;
  const label = LABEL_SLUGS.includes(p.get("l")) ? p.get("l") : null;
  const kind = KINDS.includes(p.get("k")) ? p.get("k") : null;
  const page = Math.max(1, Math.min(10_000, parseInt(p.get("p") ?? "1", 10) || 1));
  const { total, rows } = await listPlaces(env.DB, { label, kind, page });

  const href = (q) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) s.set(k, v);
    const qs = s.toString();
    return qs ? `/places?${qs}` : "/places";
  };
  const chip = (text, q, on) => `<a class="chip" href="${esc(href(q))}"${on ? ' aria-current="true"' : ""}>${esc(text)}</a>`;
  const labelChips = [chip("All labels", { k: kind }, !label), ...LABEL_ORDER.map((l) => chip(labelText(l), { l, k: kind }, label === l))].join("");
  const kindChips = [chip("All kinds", { l: label }, !kind), ...KINDS.map((k) => chip(k, { l: label, k }, kind === k))].join("");

  const items = rows
    .map((r) => {
      const name = placeName(r);
      return `<li><span class="swatch" style="background:${LABEL_COLOR[r.label] ?? "var(--line)"}"></span>` +
        `<a class="name" href="${esc(placeUrl(r))}" rel="ugc nofollow noopener" target="_blank">${esc(name)} <span aria-hidden="true">↗</span></a>` +
        `<details class="more"><summary aria-label="More for ${esc(name)}"></summary><button type="button" data-report="${esc(name)}">Report this place</button></details>` +
        `<span class="meta">${esc(labelText(r.label))} · ${esc(r.place_kind)} · since ${esc(fmtDay(r.first_verified))}</span></li>`;
    })
    .join("");
  const filtered = label || kind;
  const list = rows.length
    ? `<ul class="rows" id="rows">${items}</ul>`
    : `<p class="soft empty">${filtered ? "No named places match yet." : "None yet."}</p>`;
  const pager = page * PAGE_SIZE < total ? `<p class="pager"><a class="btn quiet" href="${esc(href({ l: label, k: kind, p: String(page + 1) }))}">Show more</a></p>` : "";
  const count = `${total} named${filtered ? " for this filter" : ""}`;

  const html = `${shell.head.replace(/<title>.*<\/title>/, `<title>${PLACES.title}</title>`).replace("__HEAD_TAGS__", headTags(PLACES))}${PLACES_CSS}</style>
</head>
<body>
${shell.nav}
<main id="top">
<section class="places-head">
  <div class="wrap">
    <h1>Places wearing Made Openly</h1>
    <p class="soft">Active places whose makers asked to be named. ${esc(count)}.</p>
    <div class="chips" role="group" aria-label="Filter by label">${labelChips}</div>
    <div class="chips" role="group" aria-label="Filter by kind">${kindChips}</div>
    ${list}
    <p class="error" id="report-msg" role="status"></p>
    ${pager}
  </div>
</section>
<section class="ask">
  <div class="wrap">
    <p><b>Wearing a verified badge?</b> <a href="/#ask-named">Ask to be named</a>. The count includes every verified place, named or not.</p>
  </div>
</section>
</main>
${shell.footer}
<script>
const rows = document.getElementById("rows");
if (rows) rows.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-report]");
  if (!b) return;
  const msg = document.getElementById("report-msg");
  let ok = false, data = {};
  try {
    const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: b.dataset.report }) });
    ok = res.ok;
    data = await res.json();
  } catch {}
  msg.className = ok ? "ok" : "error";
  msg.textContent = ok ? "Thanks. That place is hidden until we review it." : data.error || "That didn't send. Please try again.";
  if (ok) b.closest("li").remove();
});
</script>
</body>
</html>
`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Content-Security-Policy": csp,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
