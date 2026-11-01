// The badge key (SPEC.md 8.5). 20 random bytes, base32, made at Generate.
// Stored AES-GCM encrypted under the KEY_SECRET Worker secret, plus an HMAC
// of it so a key alone finds its badge. The plain key is never stored or logged.
// A key, or a 6-digit code made from it (RFC 6238: SHA-1, 30 s steps), proves
// ownership of that one badge.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const KEY_BYTES = 20;
const STEP_S = 30;
const MAX_FAILS_PER_HOUR = 5;
const enc = new TextEncoder();

export function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function unbase32(s) {
  const clean = String(s).toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(clean)) return null;
  let bits = 0, value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// A key typed or pasted by a person: spaces and case don't matter.
export const normalizeKey = (s) => (typeof s === "string" ? s.toUpperCase().replace(/[\s-]/g, "") : "");
export const isKey = (s) => /^[A-Z2-7]{32}$/.test(normalizeKey(s));
export const isCode = (s) => typeof s === "string" && /^\d{6}$/.test(s.replace(/\s/g, ""));

export const makeKey = () => base32(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));

const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`made-openly key enc:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptKey(secret, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(key)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64(out);
}

export async function decryptKey(secret, stored) {
  try {
    const data = unb64(stored);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, await aesKey(secret), data.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export async function keyLookup(secret, key) {
  const k = await crypto.subtle.importKey("raw", enc.encode(`made-openly key lookup:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(normalizeKey(key)))));
}

// The fields to store for a new key.
export async function keyColumns(secret, key) {
  return { key_enc: await encryptKey(secret, key), key_lookup: await keyLookup(secret, key) };
}

// RFC 6238 code for one 30-second step.
export async function totp(key, step) {
  const k = await crypto.subtle.importKey("raw", unbase32(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const counter = new Uint8Array(8);
  new DataView(counter.buffer).setBigUint64(0, BigInt(step));
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", k, counter));
  const o = h[19] & 15;
  const n = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000;
  return String(n).padStart(6, "0");
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Does this key or code belong to the badge row? Codes from the previous,
// current and next step are accepted.
export async function secretMatches(secret, row, given, now = new Date()) {
  if (!row?.key_enc || !secret) return false;
  const key = await decryptKey(secret, row.key_enc);
  if (!key) return false;
  if (isKey(given)) return sameText(normalizeKey(given), key);
  if (!isCode(given)) return false;
  const code = given.replace(/\s/g, "");
  const step = Math.floor(now.getTime() / 1000 / STEP_S);
  let ok = false;
  for (const s of [step - 1, step, step + 1]) if (sameText(await totp(key, s), code)) ok = true;
  return ok;
}

const hour = (now) => now.toISOString().slice(0, 13);

// Guessing limit: after 5 wrong keys or codes for a badge in an hour, every
// attempt is refused until the hour is over. Counted per badge, never per person.
export async function tooManyFails(db, token, now = new Date()) {
  const row = await db.prepare("SELECT count FROM key_attempts WHERE token = ? AND hour = ?").bind(token, hour(now)).first();
  return (row?.count ?? 0) >= MAX_FAILS_PER_HOUR;
}

export async function recordFail(db, token, now = new Date()) {
  await db
    .prepare("INSERT INTO key_attempts (token, hour, count) VALUES (?, ?, 1) ON CONFLICT (token, hour) DO UPDATE SET count = count + 1")
    .bind(token, hour(now))
    .run();
}
