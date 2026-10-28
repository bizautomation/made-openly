// Checks every mascot against CONTRIBUTING.md (SPEC.md 13.1). Run by
// .github/workflows/mascot-check.yml and by the tests. Exits 1 on any problem.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_BYTES = 10 * 1024;
const REQUIRED_FIELDS = ["slug", "name", "designer", "designer_url", "licence"];

// Problems in one SVG file's text. An empty list means it passes.
export function checkSvg(text, bytes = Buffer.byteLength(text)) {
  const problems = [];
  const root = text.match(/<svg\b[^>]*>/i);
  if (!root) problems.push("no <svg> element");
  else if (!/\sviewBox\s*=\s*["']0 0 100 100["']/.test(root[0])) problems.push('viewBox must be "0 0 100 100"');
  if (/<script\b/i.test(text)) problems.push("contains <script>");
  if (/\son[a-z]+\s*=/i.test(text)) problems.push("contains an event attribute (on...=)");
  for (const m of text.matchAll(/\s(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi))
    if (!m[1].startsWith("#")) problems.push(`external href: ${m[1]}`);
  if (/url\(\s*["']?(?!#)/i.test(text)) problems.push("external url() reference");
  if (/<image\b/i.test(text) || /data:image\/(?!svg)/i.test(text)) problems.push("embedded raster image");
  if (/<foreignObject\b/i.test(text)) problems.push("contains <foreignObject>");
  if (bytes > MAX_BYTES) problems.push(`over 10 KB (${bytes} bytes)`);
  return problems;
}

// Problems across the mascots directory: each file, and the registry both ways.
export function checkMascots(dir) {
  const problems = [];
  let registry = [];
  try {
    registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"));
    if (!Array.isArray(registry)) throw new Error();
  } catch {
    return ["registry.json: not a JSON array"];
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));
  const slugs = new Set();
  for (const entry of registry) {
    const missing = REQUIRED_FIELDS.filter((k) => typeof entry?.[k] !== "string" || !entry[k]);
    if (missing.length) problems.push(`registry.json: ${entry?.slug ?? "an entry"} is missing ${missing.join(", ")}`);
    if (entry?.slug && !/^[a-z0-9-]+$/.test(entry.slug)) problems.push(`registry.json: bad slug ${entry.slug}`);
    if (slugs.has(entry?.slug)) problems.push(`registry.json: duplicate slug ${entry.slug}`);
    slugs.add(entry?.slug);
    if (entry?.licence && entry.licence !== "CC-BY-4.0") problems.push(`registry.json: ${entry.slug} licence must be CC-BY-4.0`);
    if (entry?.slug && !files.includes(`${entry.slug}.svg`)) problems.push(`registry.json: ${entry.slug} has no ${entry.slug}.svg`);
  }
  for (const f of files) {
    if (!slugs.has(basename(f, ".svg"))) problems.push(`${f}: no entry in registry.json`);
    const path = join(dir, f);
    for (const p of checkSvg(readFileSync(path, "utf8"), statSync(path).size)) problems.push(`${f}: ${p}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkMascots(process.argv[2] ?? "mascots");
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length) process.exit(1);
  console.log("✓ mascots pass");
}
