# Made Openly: Build Specification

This document is the single source of truth for building madeopenly.com. It is written so that a developer or an AI coding agent can build the whole project from it without other context. Where a decision has a reason, the reason is given in one line so it is not undone by accident.

Status: all design decisions closed, 28 Oct 2026. Owner: Biz-Automation Co., Ltd. (GitHub: `bizautomation`).

---

## 1. What this is

Made Openly is a free badge that a person puts on their work to say, openly, how much AI was involved in making it. It is the mirror image of "Not By AI" style badges: those certify that no machine was involved; this one lets makers say a machine was involved and that they are not hiding it.

The site does three things:

1. **Gives out badges.** Anyone picks a badge, copies a snippet, pastes it into their site, repo or post. No sign-up.
2. **Counts places wearing them.** A place counts while we can see its badge there (section 8.3). It counts places, never visitors.
3. **Shows the count publicly.** A live counter, split by badge label and place type, is the experiment's result. The project is framed as a year-long experiment: who chooses to wear which badge.

The badge is a **self-declaration, not a certificate.** It vouches for honesty about how something was made, not for quality.

### The idea, for the "Why" section of the page

The question moves from purity (did a machine touch this?) to character (is the maker honest about how it was made?). The virtue is not avoiding the tool, it is not hiding it. Wearing the badge means saying: this was my hand, and the machine carried it.

---

## 2. Non-goals (do not build these at launch)

- Accounts, logins, sign-up, email capture.
- Cookies, cookie-based analytics, tracking pixels, fingerprinting. The one exception is Cloudflare Web Analytics on the page itself: it sets no cookies and uses no visitor ID, so no consent banner is needed. It never runs on the badge. Decided by the owner, 1 Nov 2026.
- Storing IP addresses (rate limiting may read them in memory only).
- A JavaScript badge tier. Image badge only.
- User uploads of mascots or images.
- Thai or any language other than English.
- Certification, auditing or any claim that a badge is "true".

---

## 3. Stack and hosting

- **Cloudflare Worker** serves the site, the badges and the API.
- **Cloudflare D1** stores badges, daily counts and contact messages.
- **Cloudflare Turnstile** protects Generate and the contact form.
- **Cloudflare Cron Trigger** runs the weekly verification check.
- **Cloudflare rate limiting** guards the endpoints (section 9).
- Account: the existing Biz-Automation Cloudflare account on the Workers Paid plan, shared with bizat.co and Muninn. Keep Made Openly **isolated**: its own Worker, its own D1 database, its own scoped API token. Never share a database with another project.
- Domain: `madeopenly.com` (registered on Cloudflare Registrar).
- Repo: `github.com/bizautomation/made-openly`, public. Secrets live in Cloudflare environment settings, never in the repo.

---

## 4. Badges

### 4.1 Labels (three degrees)

| Slug | Label on badge | AI share on the bar | Meaning (for the FAQ) |
|---|---|---|---|
| `mostly-ai` | Mostly AI | 85% | AI produced most of the final work. A person directed, chose and checked it. |
| `human-ai` | Human + AI | 50% | A person produced a real share of the final work, and AI helped. |
| `human-only` | Human only | 0% | No AI in the making, or only spelling-level help. |

The deciding question is: who produced most of the final words, code or images? The bar shows the label, not a measured share. The picker shows each meaning and this question, and someone who arrives by clicking a badge (`/?t=TOKEN`) sees what that badge's label means. `src/labels.js` holds the wording. Decided by the owner, 30 Oct 2026.

The page also gives two everyday examples per label and a tie-break: "Torn between two? Choose the one with more AI. Being open is the point." Labels are always shown in order from human to AI (Human only, Human + AI, Mostly AI). Wording in `src/labels.js`. Approved by the owner, 30 Oct 2026.

Labels avoid prepositions ("by", "with") on purpose: non-native English readers mix them up, and "Made by human" does not fit the small badge.

### 4.2 Sizes

| Size | Pixels | Icon size | Notes |
|---|---|---|---|
| `small` | 88 × 31 | 22 px | Classic web button. Fits footers. |
| `large` | 176 × 62 | 48 px | **Default in the picker.** Shows "MADE OPENLY" readably. |

### 4.3 Styles

| Style | Background | Border | Text |
|---|---|---|---|
| `light` | white `#FFFFFF` | Ink at 25% | Ink |
| `dark` | Ink `#1F2937` | white at 12% | light `#F3F4F6` |
| `clear-light` | none (transparent) | Ink at 30% | Ink |
| `clear-dark` | none (transparent) | white at 30% | light `#F3F4F6` |

Optional later: `auto`, one SVG with an internal `prefers-color-scheme` media query. It follows the visitor's OS setting, not a site's own theme toggle.

### 4.4 Variants

- `robot` (default): mascot icon on the left, "MADE OPENLY" and label on the right.
- `wordmark`: no icon. "MADE OPENLY" above the label, centred. For formal sites.

### 4.5 The bar

A thin bar under the label shows the split. The track is **clay** (human); the fill from the left is **teal** (machine), at the AI share from 4.1. "Human only" shows an all-clay bar. The bar carries the meaning without reading English.

### 4.6 Exact layout

Use the reference generator in `reference/badges.html` (section 15). Its functions `robot(onDark)` and `badge(size, style, label, variant)` are the canonical implementation. Port them to the Worker unchanged in output. Key numbers, for checking:

- Small, robot: icon at x=2, y=4.5, 22×22. Label at x=25, y=17, 10 px, weight 600. Bar at x=25, y=22, width 57, height 3.
- Small, wordmark: "MADE OPENLY" centred at y=11.5, 6.8 px, weight 700, letter-spacing 0.6. Label centred at y=22, 9.5 px. Bar x=8, y=25.5, width 72, height 2.5.
- Large, robot: icon at x=6, y=7, 48×48. "MADE OPENLY" at x=58, y=20, 9 px, weight 700, letter-spacing 0.8. Label at x=58, y=38, 16 px. Bar x=58, y=45, width 110, height 3.
- Large, wordmark: "MADE OPENLY" centred at y=21, 11 px, letter-spacing 1.4. Label centred at y=40, 16 px. Bar x=16, y=48, width 144.
- Corner radius 5 (small), 8 (large). Border drawn as a 1 px stroke inset 0.5 px.
- Font stack: `Inter, Helvetica, Arial, sans-serif`. "MADE OPENLY" uses teal `#0F766E` on light, `#5EC4B6` on dark.
- Every SVG carries `role="img"`, `aria-label` and `<title>` set to `Made Openly: <Label>`.

### 4.7 The mascot (open-hatch robot)

A small robot whose chest hatch has swung open, with a heart inside. Meaning: nothing hidden, and what is inside is human. The swung-open door is the distinctive part; keep it prominent.

Geometry on a 100×100 canvas (the generator draws it; these numbers are for review):

- Antenna: line (50,6)→(50,16), stroke 4, round cap; ball r=4 teal at (50,6).
- Head: rect x=24 y=16 w=52 h=34 rx=12, Ink. Eyes: white circles r=5 at (40,33) and (60,33).
- Body: rect x=22 y=54 w=56 h=40 rx=10, Ink.
- Hatch hole: rect x=35 y=60 w=30 h=28 rx=4.5, white. Heart: clay, centred at (50,74.5), scale 1.15.
- Door: modelled in 3D, the same size and corner radius as the hole, hinged on the hole's right edge (x=65), swung 125° toward the viewer, perspective camera distance 220, centre (50,55), thickness 2.4. Front face teal `#0F766E`, back and edge `#0A4F4A`, white knob r=1.4 near the free edge. The door pokes slightly past the body edge; this is correct, not a bug.
- **On dark backgrounds the robot is never recoloured.** It keeps its Ink body and gains a light outline: stroke `#E5E7EB`, width 3, on head and body; the antenna stroke turns light too.

### 4.8 Mascot picker

Users can choose the icon on their badge. Launch set:

| Slug | Name | Status |
|---|---|---|
| `robot` | Open-hatch robot | Final. Default. |
| `bird` | Half-bot bird | Sketch only. Landing-page mascot. Ship when final art exists. |
| `pen-bot` | Pen bot | Sketch only. |
| `split-nib` | Split nib | Sketch only. |
| `open-ring` | Open ring | Sketch only. |

Only mascots with final art go in the registry. Sketches stay out until finished.

The picker reads the mascot registry (section 13.1). Each choice shows its designer's name. A "Design one" link goes to `CONTRIBUTING.md`. The chosen slug travels in the badge URL (`&m=robot`) and is stored with the token.

---

## 5. Colour palette

One palette. Colours carry meaning: **teal = machine, clay = human, ink = structure.**

| Token | Hex | Use |
|---|---|---|
| Paper | `#FAF8F5` | page background |
| Ink | `#1F2937` | text, robot body, dark badge |
| Ink soft | `#6B7280` | secondary text |
| Line | `#E5E7EB` | borders, robot outline on dark |
| Machine | `#0F766E` | AI share, buttons, links, door |
| Machine on dark | `#5EC4B6` | teal text on dark backgrounds |
| Machine deep | `#0A4F4A` | door back and edge |
| Machine tint | `#CCE7E4` | teal backgrounds |
| Human | `#E39565` | human share, heart. Fills only, never text (2.4:1 on white). |
| Human deep | `#B45309` | human-coloured text on light |
| Alert | `#B91C1C` | form errors only |
| Dark text | `#F3F4F6` | text on dark badges |

Contrast checked: Ink on Paper 13.8:1, Machine on white 5.5:1, Human deep on white 5.0:1.

---

## 6. The snippet

### Live badge (Way A)

```html
<a href="https://madeopenly.com/?t=TOKEN" title="Made Openly: Human + AI">
  <img src="https://madeopenly.com/b/TOKEN.svg?l=human-ai&s=light&z=large&v=robot&m=robot"
       width="176" height="62" alt="Made Openly: Human + AI">
</a>
```

- `width` and `height` are always set, so a failed load never shifts the page layout.
- `alt` keeps the meaning if the image is blocked.
- An image tag never blocks the host page: if the Worker is down, the page loads normally and the badge shows its alt text.

### Theme swap (document on the site)

For sites with their own light/dark toggle, offer a copy-ready snippet that swaps `s=light` and `s=dark` when the page theme changes (a `MutationObserver` on the page's theme attribute). Tested on bizat.co: the swap is instant.

### AI assistant prompt

After Generate, the page also offers a copy-ready prompt for an AI coding assistant such as Claude Code. Pasted into the assistant inside the site's or repo's project, it adds the badge: to the shared footer for a site or product (with the theme-swap version for sites with a theme toggle), or under the title of `README.md` for a repo. It tells the assistant to keep the token, URLs, size and alt text exactly, never to download the image, and to show the diff before committing. Posts (Substack, Medium) get no prompt, since there is no project to edit. Decided by the owner, 29 Oct 2026.

### PNG version (counted)

The same snippet with `/b/TOKEN.png` instead of `/b/TOKEN.svg`, for email signatures, LinkedIn, office documents and site builders that refuse SVG. It counts the same way. It sits under "More ways to add it".

PNGs are never converted per request. There are only 48 badges (3 labels × 4 styles × 2 sizes × 2 variants) plus 8 neutral ones, so `scripts/render-pngs.js` draws each one once, at 2× for high-density screens, into `public/png/<label>-<style>-<size>-<variant>.png` and `public/png/neutral-<style>-<size>.png`. Rerun it after changing the badge drawing. SVG stays drawn in code: the Worker runs on every load to count anyway, and drawing takes microseconds. (Owner, 1 Nov 2026.)

### Plain badge (no tracking)

A downloadable SVG or PNG with no token, for PDFs, ebooks, videos and app store pages. It is never counted. The PNG is the static file in `public/png/`.

---

## 7. Data model (D1)

```sql
CREATE TABLE badges (
  token          TEXT PRIMARY KEY,          -- random, >= 16 chars, from crypto.randomUUID()
  label          TEXT NOT NULL,             -- mostly-ai | human-ai | human-only
  style          TEXT NOT NULL,             -- light | dark | clear-light | clear-dark
  size           TEXT NOT NULL,             -- small | large
  variant        TEXT NOT NULL,             -- robot | wordmark
  mascot         TEXT NOT NULL DEFAULT 'robot',
  host           TEXT,                      -- bound host (Way A), e.g. blog.example.com
  declared_url   TEXT,                      -- optional page URL given at Generate (Way B)
  place_kind     TEXT NOT NULL DEFAULT 'site', -- site | repo | post | product
  verify_method  TEXT,                      -- live | address
  status         TEXT NOT NULL DEFAULT 'new', -- new | active | dormant | declared | flagged (section 8.3)
  listed         TEXT NOT NULL DEFAULT 'no',  -- no | asked | pending | yes | reported | removed (section 12)
  created_at     TEXT NOT NULL,
  bound_at       TEXT,
  first_verified TEXT,                      -- first sighting by either signal
  last_verified  TEXT,                      -- last time the Worker check found it
  last_seen      TEXT,                      -- YYYY-MM-DD (UTC): latest sighting by either signal
  key_enc        TEXT,                      -- badge key, AES-GCM under the KEY_SECRET secret (section 8.5)
  key_lookup     TEXT,                      -- HMAC of the key, to find a badge by its key
  key_sent       INTEGER NOT NULL DEFAULT 0 -- 1 once the key was emailed; the address is never stored
);
CREATE INDEX badges_host ON badges(host);
CREATE INDEX badges_status ON badges(status);
CREATE UNIQUE INDEX badges_key_lookup ON badges(key_lookup);

CREATE TABLE key_attempts (                -- wrong keys or codes per badge per hour; no IP
  token TEXT NOT NULL,
  hour  TEXT NOT NULL,                      -- YYYY-MM-DDTHH (UTC)
  count INTEGER NOT NULL,
  PRIMARY KEY (token, hour)
);

CREATE TABLE daily (
  token TEXT NOT NULL,
  day   TEXT NOT NULL,                      -- YYYY-MM-DD (UTC)
  PRIMARY KEY (token, day)
);

CREATE TABLE messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE weekly_counts (               -- anonymous snapshot, written by the weekly check
  week     TEXT NOT NULL,                  -- ISO week, e.g. 2026-W45
  label    TEXT NOT NULL,
  kind     TEXT NOT NULL,
  verified   INTEGER NOT NULL,             -- active places with this label and kind that week
  added      INTEGER NOT NULL DEFAULT 0,   -- active + dormant + unverified
  dormant    INTEGER NOT NULL DEFAULT 0,
  unverified INTEGER NOT NULL DEFAULT 0,   -- status 'declared'
  PRIMARY KEY (week, label, kind)
);
```

`weekly_counts` holds counts only, never a token or host, so removing a badge still deletes all of its data while past weeks of the growth line stay correct.

No IP address, user agent, visitor identifier or email address is stored anywhere. The plain badge key is never stored or logged.

---

## 8. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | The single page (section 11). |
| POST | `/api/generate` | Create a token, return the snippet. |
| GET | `/b/:token.svg`, `/b/:token.png` | Serve a badge and record the day. |
| GET | `/badge.svg` | Preview only (picker). Same params, no token, never records. |
| GET | `/stats.json` | Public counter data (section 10). |
| POST | `/api/list` | Ask for a place to be named on the public list. |
| POST | `/api/report` | Report a listed place. |
| POST | `/api/contact` | Contact form. |
| GET | `/admin/review?k=...` | One-click approve/reject links from the weekly email (signed). |
| GET | `/places` | Every named place (section 11.3). |
| GET | `/manage` | Manage a badge with its key (section 8.5). |
| POST | `/api/manage`, `/api/manage/remove`, `/api/manage/list` | Open, remove or list a badge with its key or code. |
| POST | `/api/send-key` | Email a badge key once. |
| GET | `/og.png`, `/sitemap.xml` | Share image and sitemap (section 11.4). |

### 8.1 `POST /api/generate`

Input: `label, style, size, variant, mascot, declared_url (optional), is_product (optional), list (optional boolean), turnstile_token`.

1. Verify Turnstile server-side. Reject on failure.
2. Check rate limits (section 9).
3. Make a token: `crypto.randomUUID()` with dashes removed, or any random string of at least 16 characters.
4. `INSERT` into `badges` with `status='new'`, or `status='declared'` when an address is given, and `listed='asked'` when `list` is true (else `'no'`). The token is the primary key. If the insert fails on a conflict, generate a new token and retry, **at most 3 times**, then return an error. Never loop.
5. If `declared_url` is given: validate it is `https://`, set `verify_method='address'` and set `place_kind` (section 8.4).
6. Make the badge key (section 8.5) and store it encrypted.
7. Return the ready snippet (section 6), the plain-text version and the key. The key is shown once and never again.

### 8.2 `GET /b/:token.svg` and `/b/:token.png` (the hot path)

1. Look up the token. Unknown token: return a neutral "Made Openly" badge, record nothing.
2. Draw the SVG. The label always comes from storage, since it is what the counter counts. The look comes from the query string: `s` style, `z` size, `v` variant, so a site can swap themes without a new token. A missing or invalid value falls back to the stored setting. (Decided by the owner, 29 Oct 2026.)
3. Read the `Referer` header. Take its host. If it is missing, `localhost`, an IP address, or a known preview host (`*.pages.dev`, `*.vercel.app`, `*.netlify.app` previews, `127.0.0.1`, etc.), draw the badge and record nothing.
4. If the token has no host yet and the referrer host is valid: bind it (`host`, `bound_at`, `verify_method='live'`).
5. If the token is bound to host A and the referrer is host B: record nothing, and set `status='flagged'` (someone copied another site's snippet).
6. A load from the bound host is a sighting (section 8.3): `INSERT OR IGNORE INTO daily (token, day)` for today, one row per token per day however many loads, and the first row of the day marks the place seen.
7. Respond with `Content-Type: image/svg+xml` (drawn in code) or `image/png` (the pre-drawn file, section 6), and `Cache-Control: public, max-age=300` (short, so loads keep reaching the Worker).
8. **Cost:** once a place is marked seen today (`last_seen`), later loads skip the write, so a load is one D1 read and no write.
9. **Over the per-IP limit** (often a shared proxy such as GitHub camo or Gmail): still draw the badge, but bind and record nothing, so the host page never shows a broken image. Floods are stopped earlier by the zone WAF rule (section 9).

### 8.3 Sightings: active, dormant and declared places

A place is a token with a bound `host` or a `declared_url`. It counts while either of two signals sees it. Fetching other people's pages is fragile (Substack answers the checker with HTTP 429, and other hosts may block it), so one signal is enough, and losing both only pauses the count.

**Signal 1, the badge itself.**
- **Load:** the badge image loads with a valid Referer from the place's bound host (section 8.2).
- **Click:** a reader clicks the badge and the browser opens `madeopenly.com/?t=TOKEN` with a Referer whose host is the place's bound host or the host of its declared address. Most sites send only the origin, so only the host is compared; the token says which place it is. A click never binds a token. Platforms that re-host the image (Substack, Medium, GitHub) still send a Referer on a click.
- Either one writes the same single `daily` row per token per day, and nothing about the visitor. A Referer can be faked; the owner accepts that.

**Signal 2, the Worker check.** It looks for the token at the place:
- **GitHub repos:** the official API, `GET https://api.github.com/repos/<owner>/<repo>/readme` with `Accept: application/vnd.github.raw`, with the optional `GITHUB_TOKEN` secret.
- **Every other place:** fetch `declared_url` if set, otherwise `https://<host>/`, and look for the token in the badge link href (`madeopenly.com/?t=TOKEN`), the image src (`/b/TOKEN.svg`), a GitHub camo URL (hex-decoded) or a percent-encoded image proxy URL. On HTTP 429 it waits for `Retry-After` (at most 5 seconds) and asks once more.
- Use a polite `User-Agent`: `MadeOpenlyVerifier/1.0 (+https://madeopenly.com/#faq)`. Fetch in batches with a short delay between them.
- It runs every Monday at 02:00 UTC for every place, and every 15 minutes for places not yet active that were bound or declared in the last 7 days (at most 50 per run, newest first).

**Statuses**

| Status | Meaning | Counted as |
|---|---|---|
| `active` | Seen by either signal in the last 30 days | the main counter |
| `dormant` | Seen before, but nothing in the last 30 days | "not seen lately" |
| `declared` | Has a declared address, never seen by either signal yet | "not verified yet" |
| `new` | Not bound and not declared | not counted |
| `flagged` | Its snippet was loaded on a second host | not counted |

- Any sighting makes the place `active`, sets `last_seen` to today and `first_verified` if empty. A flagged place is cleared only when the Worker check finds it on its own page.
- A failed check (404, 429, 5xx, network error) only means "not seen this time". It never deletes and never changes a status.
- An active place with no sighting for 30 days becomes `dormant`, in the 15-minute run. The next sighting makes it active again.
- A place that asked to be named (`listed='asked'`) moves to `listed='pending'` with its first sighting (section 12).
- When a run turns a place active or dormant, the cached `/stats.json` is purged.

**Removal.**
- Places that were ever bound or declared are never deleted automatically. A dormant or declared record stays until it is removed.
- The badge owner removes it completely with the badge key (section 8.5).
- The site owner removes records by hand: for contact-form requests, and for old records he decides to clear (for example, no sighting for a year). The Monday review email shows "Places with no sighting for 12+ months: n" so he can decide. There is no delete button in the email.
- Tokens created more than 30 days ago and never bound or declared are deleted by the Monday check (bot cleanup). Key attempt rows older than a day are deleted then too.

Decided by the owner, 1 Nov 2026.

### 8.4 Place types

Detected from the address, with one checkbox:

| Address | `place_kind` |
|---|---|
| `github.com/<owner>/<repo>` | `repo` |
| `*.substack.com`, `medium.com`, `*.medium.com`, Substack custom domains if detectable | `post` |
| User ticked "This is a product" | `product` |
| Anything else | `site` |

Many tokens may share one host (medium.com, github.com, substack.com). A token is one place.

### 8.5 The badge key

At Generate the Worker makes a key for the badge: 20 random bytes, base32 encoded (32 characters), so authenticator apps accept it.

- **Stored:** encrypted with AES-GCM under the `KEY_SECRET` Worker secret (`key_enc`), with an HMAC of it (`key_lookup`) so a key alone finds its badge. The plain key is never stored or logged. Without `KEY_SECRET`, badges are made without a key; badges made before keys existed have none.
- **Proves:** the key, or a 6-digit code made from it (RFC 6238: SHA-1, 6 digits, 30-second step, the previous and next step accepted), proves ownership of that one badge. With it the owner can take the place off Made Openly completely, and turn its public listing on or off. Future owner tools use the same key. The key never touches the maker's own page.
- **Guessing limit:** after 5 wrong keys or codes for a badge within an hour, every attempt is refused until the hour ends. Counted per badge in `key_attempts`, never per person.

**Ways to keep it (all optional, after the snippet):**
- **Copy link:** `https://madeopenly.com/manage#k=<key>`. The key sits after `#`, so it never reaches server logs or Referer headers.
- **Save picture:** a PNG card with the QR code, "Made Openly badge key", the place, the key as text, and "Open madeopenly.com/manage to use it."
- **Add to authenticator:** the same QR, encoding `otpauth://totp/Made%20Openly:<place>?secret=<key>&issuer=Made%20Openly`, with "Scan it with Google Authenticator, 1Password or a similar app." The QR is drawn in the browser by code bundled in the repo (`public/vendor/qrcode.js`, MIT), never an outside script.
- **Email it to me:** the browser posts `{token, key, email}` to `POST /api/send-key`. The server checks the key against the token and sends one email through Resend with the link and the key. The address is used for that one send and is not stored. One send per badge, and per-IP limits (section 9).
- **Nothing:** fine. The contact form is the fallback.

**`GET /manage`.** With `#k=` in the address, the page opens the badge at once and removes the key from the address bar. Without it, two fields: "Badge or page address" and "Key or 6-digit code". It shows the place, its label, its listing state and whether it counts now (active, dormant or declared), with two buttons:
- **Remove from Made Openly**, which asks once to confirm. It deletes the `badges` row, its `daily` and `key_attempts` rows, and purges the cached `/stats.json`. The page then says: "Done. Your place is off Made Openly: no count, no listing, no data. The badge on your page now shows a plain Made Openly mark. Take it off your page whenever you like." A badge left on the page has an unknown token, so it draws the neutral badge and records nothing (section 8.2).
- **Name it on the list** or **Take it off the list** (section 12).

Decided by the owner, 1 Nov 2026.

---

## 9. Rate limits and abuse

Limits are keyed by IP using Cloudflare's rate limiting. The IP is held in memory by the limiter only and **never written to D1 or logs**. There are no sessions, because there are no cookies.

| Endpoint | Guard | Limit |
|---|---|---|
| `/api/generate` | Turnstile + per-IP | 10 per 10 minutes, 50 per day |
| `/b/:token.svg`, `.png` | Over 300 per minute per IP the Worker still draws the badge but records nothing | Flood rule only: block an IP above ~300 requests per minute |
| `/api/contact` | Turnstile + per-IP | 3 per hour |
| `/api/list`, `/api/report` | per-IP | 10 per hour |
| `/api/manage*` | per-IP, plus 5 wrong keys per badge per hour (section 8.5) | 10 per minute |
| `/api/send-key` | per-IP, one send per badge | 3 per hour |

The Workers rate-limit binding only counts over 10 or 60 seconds, so the Worker enforces per-minute limits (Generate 5, contact 1, list/report 3, manage 10, send-key 3 per minute per IP, badge 300) and the longer windows above are zone WAF rate-limiting rules. Decided by the owner, 28 Oct 2026.

Cleanup: tokens never bound or declared within 30 days are deleted by the weekly job.

---

## 10. Counter and `/stats.json`

### What counts

Every place that was **added** (it has a bound host or a declared address) is shown, not only the ones that count:

- **Active:** status `active`. These are the main count.
- **Not seen lately:** status `dormant`.
- **Not verified yet:** status `declared`.

**Added** = active + not seen lately + not verified yet. Tokens generated but never placed are not added.

**Counts are per place, not per token.** Several badges at the same place count once: the key is the declared address without `https://` and a trailing slash, or else the bound host, lowercased and without `www.`. The place takes the status and label of its most-seen badge (active, then dormant, then declared; then the latest sighting). A different page on the same site (`site.example/about`) is a different place. This applies to every number, `/stats.json`, `/places`, the named list and the weekly snapshot. Duplicates stay in the database and are not deleted. (Owner, 1 Nov 2026.) Each place is seen once a day at most (`daily` table). Visits are never counted or shown.

### `/stats.json` (public, no auth, cached ~1 hour)

```json
{
  "updated": "2026-11-02T02:30:00Z",
  "total_verified": 0,
  "by_label": { "mostly-ai": 0, "human-ai": 0, "human-only": 0 },
  "by_kind":  { "site": 0, "repo": 0, "post": 0, "product": 0 },
  "by_label_kind": { "mostly-ai": { "site": 0, "repo": 0, "post": 0, "product": 0 } },
  "added_total": 0,
  "dormant_total": 0,
  "unverified_total": 0,
  "by_status_label": {
    "active":     { "mostly-ai": 0, "human-ai": 0, "human-only": 0 },
    "dormant":    { "mostly-ai": 0, "human-ai": 0, "human-only": 0 },
    "unverified": { "mostly-ai": 0, "human-ai": 0, "human-only": 0 }
  },
  "weekly": [ { "week": "2026-W45", "verified": 0, "added": 0, "dormant": 0, "unverified": 0 } ],
  "new_last_7_days": 0,
  "listed_total": 1,
  "listed": [ { "place": "example.com", "url": "https://example.com/", "label": "human-ai", "kind": "site", "since": "2026-11-02" } ]
}
```

`total_verified`, `by_label`, `by_kind`, `by_label_kind` and `new_last_7_days` count active places; the weekly scheduled task reads these keys, so they keep their names. `listed` holds active named places only, newest first, at most 200; `listed_total` is their full count. The `/places` page shows them all.

`weekly` comes from `weekly_counts` (one snapshot per weekly run), not from the current `badges` rows.

Optional: `/stats.json?since=YYYY-MM-DD` returns only places first seen (or, for declared places, created) since that date. This endpoint is how a scheduled assistant reads the numbers for the weekly marketing report, and it powers the on-page counter.

### On the page

- Above the bars, one row of four numbers: **12** added · **8** active · **1** not seen lately · **3** not verified yet. Each number shows a short hint on hover or tap. Active: "We can see the badge there now." Not seen lately: "We saw it before, but not in the last 30 days." Not verified yet: "Added, but we haven't been able to see it yet. Substack and Medium often hide it from us."
- Active places per badge label, as bars in the label colours (Mostly AI teal, Human + AI mid-teal `#5FA8A0`, Human only clay). A small **Show all added** toggle switches the bars to every added place by label.
- The opt-in named list as a teaser: the newest six places as cards in their label colour, each linking to the place, and a **See all N →** link to `/places`.
- One plain line under the counter: **"This counts places wearing the badge, not visitors. A place is active while we can see the badge there, through its image loading, a click on it, or by finding it on the page. We show every place that was added, including the ones we can't see."**

---

## 11. The page

One page, mobile-first, one column on phones. A small jump menu at the top. Sections in order:

1. **Hero.** One line saying what this is: a badge for things made with AI, worn openly. Below it, the three badges side by side, a **Get a badge** button and a **What the labels mean** link. The half-bot bird mascot can appear here when its art is final.
2. **Labels.** "Three labels, one question": the deciding question, a scale from all human to all AI with the three labels marked, and a card per label with its badge, meaning and two examples, then the tie-break (section 4.1).
3. **Why.** Three or four lines from section 1 ("The idea").
4. **Badge picker.** Choose label, size (large default), style, robot or wordmark, mascot. Live preview from `/badge.svg`. Optional field: "Where will this badge live? (paste the page address)". Under it a checkbox, unticked by default: "Name this place on the public list", with the hint "Your place appears on the list after the badge is found there and we approve it." Then a "This is a product" checkbox. Turnstile. A **Generate** button shows the result, calm and short:

   - "✓ Your badge is ready", the snippet and one main button, **Copy badge**. When the list box was ticked, one line: "You asked to be named. Once the badge is found and approved, your place appears on the list."
   - A row, **"On Substack, Medium or Notion?"**, open when the address is a Substack or Medium page, closed otherwise. Their editors don't take HTML, so it gives four steps: download the badge PNG, add it as an image, link the image to `https://madeopenly.com/?t=TOKEN` (with Copy), and set the alt text "Made Openly: <label>" (with Copy). "It counts when a reader clicks it, or when we find the link on your page."
   - A closed row, **"Want to remove or change it later?"** with "Save a key" under it. Opened, it shows one line, "You'll need it to remove or change this badge. We only show it now.", and four buttons: Copy link, Save picture, Authenticator app, Email it to me (section 8.5).
   - A closed row, **"More ways to add it"**, holding the light/dark theme-swap snippet and the AI assistant prompt.

   Then a link to download the plain no-tracking badge. Nothing stands between a visitor and their snippet: the key and the extras wait behind the two closed rows. The page never uses the words TOTP, 2FA, hash or encrypt. (Owner, 1 Nov 2026.)
5. **Counter.** Section 10.
6. **FAQ.** Section 11.1.
7. **Contact.** Name, email, message, Turnstile. Stored in `messages` and forwarded to the owner's inbox.
8. **Privacy** (small footer, about 14 px, not tiny). Section 11.2.

### 11.3 The `/places` page (owner, 1 Nov 2026)

A second page, served by the Worker and readable without script, with the same nav, styles and privacy footer as the main page.

- Every named place (`status='active'`, `listed='yes'`), newest first, 50 to a page with a **Show more** link.
- Filter chips by label and by kind; each filter has its own address (`/places?l=mostly-ai&k=repo`).
- Each row: a bar in the label colour, the place name linking to the place, then label, kind and the date first seen.
- Links to listed places open in a new tab with `rel="ugc nofollow noopener"`. The list is user-submitted, so it passes no search credit.
- **Report** lives in a small "⋯" menu on each row (section 12).
- No favicons, screenshots or other images fetched from listed places.
- A closing line links to the "Ask to be named" form on the main page.

### 11.4 Link previews and search (owner, 1 Nov 2026)

Links to the site show a card on LinkedIn, X, Facebook, Slack and LINE. Static tags only: no cookies, no script, nothing that reads visitors.

- **Share image** `/og.png`: 1200 x 630 PNG under 300 KB, drawn once by `scripts/render-og.js` from `reference/badges.html`. Paper background, the three large light robot badges (Mostly AI, Human + AI, Human only) stacked and centred, each 470 px wide, 26 px apart, with a soft shadow. No other text. Served by the Worker with `Cache-Control: public, max-age=604800`.
- **Tags on `/` and `/places`:** `description`, `og:type` website, `og:site_name`, `og:url`, `og:title`, `og:description`, `og:image` with width, height and alt, and the matching `twitter:` tags with `summary_large_image`. `/` uses the title "Made Openly: say how much AI helped make your work" and the description "A free badge that says how much AI helped make your work. Three labels: Mostly AI, Human + AI, Human only. We count places, never visitors." `/places` has its own title and description and the same image.
- **Canonical:** `https://madeopenly.com/` and `https://madeopenly.com/places`, never with a query string, so `/?t=TOKEN` points back to `/`.
- **JSON-LD:** a `WebSite` object on `/` only.
- **`/sitemap.xml`:** `/` and `/places` only, as `application/xml`. Never `/manage`, `/stats.json`, badge or API addresses.
- **`/robots.txt`:** Cloudflare's managed file (content signals), set on the zone. The Worker serves none, because a Worker robots.txt replaces the managed one (seen live 1 Nov 2026). The sitemap is submitted in Search Console instead.
- `/manage` has no share tags and keeps `noindex`.

### Style

Clean, formal, standard; not techy. Font: Inter. Lots of white space. Paper background, Ink text, Machine teal for buttons and links. No dark mode for the page at launch, no glow effects.

### 11.1 FAQ (seed questions; write plain, short answers)

- What does each badge mean, and who decides which one fits? (You decide. Section 4.1 meanings.)
- Is this tracking my visitors? (No. It counts places, not people, and stores no IP addresses.)
- What exactly do you record? (The place, the badge chosen, and the days it was seen. Nothing about visitors.)
- How do I remove my badge or my data? ("Take the badge off your page and it stops counting within a month. We keep a small record (the place, the label, the days it was seen), so it counts again if the badge comes back. To remove it completely, open madeopenly.com/manage with your badge key. No key? Write to us and we'll remove it.")
- Why is there no sign-up?
- Can I trust the counter? (Once-a-day rule; a place counts only while its badge loads there, is clicked from there, or is found on the page.)
- When does my place start counting? (Added at Generate if a page address is given, otherwise at the first load from the site; the first load binds and makes it active; Substack, Medium, Notion and GitHub wait in "not verified yet" until the check or a click confirms it; 30 days unseen is "not seen lately", kept and counted again when seen.)
- Why does the badge image load from madeopenly.com? Can I host it myself? (Each load from the site is the sign, one mark per badge per day, nothing about the visitor; a load with no Referer cannot bind, so give the page address; a self-hosted image is never seen loading, but the check finds the link if the address is given, and a click counts.)
- What if the badge has no token, or someone copies mine? (No token: shows the label, counts nowhere, nothing kept; unknown token: neutral badge, nothing recorded; a token binds to the first host; a load from a second host records nothing and flags the place, which is not counted until the Worker check finds it on its own page, up to a week; generate a new badge for a second place.)
- Why does the badge link back to madeopenly.com? (So a reader can learn what the label means; a click is often the only sign on platforms that copy images; the link carries the badge ID for the check; nothing about the reader is recorded; without the link it still counts on a website and in a GitHub README, maybe never on Substack, Medium or Notion.)
- Does it work on Substack, GitHub, Medium or Notion? (Yes: paste the page address when you generate the badge. GitHub takes the code; on Substack, Medium and Notion add the badge PNG as an image linked to the badge link.)
- What about apps, PDFs or videos? (Use the plain badge. It is not counted.)
- Is it free? Where is the code? (Free. Link to the GitHub repo.)
- Can I design a mascot? (Yes. Link to CONTRIBUTING.md.)
- Why build this? (Two lines: the mirror of "made by humans" badges.)
- "We may remove any place from the public list without notice. It still counts."

### 11.2 Privacy note (a few short paragraphs)

- The badge records the place it appears (site, repo or page address), the badge chosen, and the days it was seen. Nothing about the people who visit that place.
- No cookies, and nothing stored on your device. No IP addresses stored by us.
- We count visits to this page with Cloudflare Web Analytics. It sets no cookies, uses no visitor ID and does not follow you to other sites. The badge itself never runs it.
- The contact form keeps your name, email and message, used only to reply.
- Turnstile, a Cloudflare service, protects the forms.
- A place stops counting when we can no longer see its badge. We keep its small record until you remove it with your badge key, ask us to remove it, or we clear old records.
- If you ask us to email your badge key, we send it once and do not keep your address. Our mail service keeps a short delivery log.
- Run by Biz-Automation Co., Ltd., Bangkok, Thailand.

No cookie banner is needed: nothing is stored on the visitor's device. A short legal review before launch is recommended.

---

## 12. Public list and moderation

Only the public **named list** is moderated. The **counts are never moderated**: every active place counts, whatever it is.

1. Listing is opt-in and off by default (`listed='no'`).
2. A maker asks to be named at Generate (the "Name this place on the public list" box), later with the "Ask to be named" form (`POST /api/list`), or on `/manage` with the badge key. A place not seen yet gets `listed='asked'`; its first sighting moves it to `listed='pending'`. A place already seen goes straight to `pending`. Either way it waits for a first sighting, then for the owner's approval.
3. Once a week the owner receives one email listing pending places, each with signed one-click **Approve** and **Reject** links (`/admin/review`). Approve → `yes`. Reject → `no`. `asked` places never appear in the email.
4. Every listed place on `/places` shows a small **Report** action → `listed='reported'`, hidden until the owner reviews it. Only `yes` places can be reported. The weekly email also lists reported places: **Keep listed** → `yes`, **Remove** → `removed`.
5. A listed place shows only while it is `active`. A dormant place is hidden and keeps its approval; it shows again at its next sighting. `asked` places never show on `/stats.json`, `/places` or the home page.
6. A removed place keeps counting; it is only hidden from the list, and cannot ask again.
7. Review links are signed (HMAC-SHA256 with the `ADMIN_SIGNING_KEY` secret) and expire after 14 days. A link only acts while the place is still in the state it was sent for. Mail goes through Resend from `we@madeopenly.com` to the owner (`ADMIN_EMAIL` secret), or once to a maker who asked for their badge key. Decided by the owner, 29 Oct and 1 Nov 2026.

---

## 13. Repository layout

```
/
├─ SPEC.md                 this file
├─ README.md               what it is, how to add a badge, link to the site
├─ CONTRIBUTING.md         how to propose a mascot (section 13.1)
├─ LICENSE                 MIT, for the code
├─ LICENSE-ART             CC BY 4.0, for badge art and mascots
├─ reference/badges.html   reference generator and gallery of every badge
├─ mascots/
│  ├─ registry.json        [{ slug, name, designer, designer_url, licence }]
│  └─ robot.svg            viewBox 0 0 100 100
├─ src/
│  ├─ index.js             Worker entry and routing
│  ├─ badge.js             port of reference/badges.html (robot, badge)
│  ├─ verify.js            weekly check
│  ├─ stats.js             /stats.json
│  └─ page.html            the single page
├─ migrations/0001_init.sql
├─ wrangler.toml           D1 binding, cron, routes (no secrets)
└─ .github/workflows/mascot-check.yml
```

### 13.1 Community mascots (CONTRIBUTING.md content)

Mascots live in the repo as SVG files. Anyone can propose one by pull request; the owner reviews and merges, and merging is the moderation. Merged mascots appear in the picker on the next deploy, with the designer credited.

Rules, checked by `mascot-check.yml` where possible:

- Original work only. No existing characters, mascots, logos or brands.
- `viewBox="0 0 100 100"`. Readable at 20 × 20 inside the small badge.
- No `<script>`, no event attributes, no external references (`href` to other files or URLs), no embedded raster images. Maximum 10 KB.
- Use the palette in section 5 where possible.
- Add an entry to `mascots/registry.json` with your name and link.
- By contributing, the designer agrees to license the art under CC BY 4.0 (LICENSE-ART).

---

## 14. Build order and acceptance checks

1. **Badge rendering.** Port the generator. `/badge.svg` renders all 48 combinations (2 sizes × 4 styles × 3 labels × 2 variants) identically to `reference/badges.html`.
2. **Generate + D1.** Tokens are unique, retries capped at 3, Turnstile enforced, rate limits enforced.
3. **Live badge.** First valid referrer binds; localhost and previews ignored; second host flags; one `daily` row per token per day; nothing about the visitor stored.
4. **Weekly check.** Finds tokens in link href, img src and GitHub camo URLs; deletes removed badges; releases never-found tokens after 30 days; deletes never-used tokens after 30 days.
5. **Stats.** `/stats.json` matches the schema in section 10 and is cached about an hour.
6. **Page.** All seven sections, mobile-first, readable at 360 px wide, no horizontal scroll.
7. **Moderation.** Pending list email with signed links; Report hides immediately.
8. **Privacy check.** Grep the code and D1: no IP, no user agent, no cookie set anywhere.
9. **Dogfood.** Put the badge on bizat.co (clear style, theme swap), the Conversation Daemon (Way B, declared address) and the repo README (Way B). All three verify on the first weekly run.

---

## 15. Reference

`reference/badges.html` contains the generator that defines every badge and both mascot versions, and draws them all in a gallery. Open it in a browser to see the agreed set. If the Worker's output differs from `reference/badges.html`, the reference file is right.
