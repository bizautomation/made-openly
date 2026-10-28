import { verifyTurnstile, withinLimit } from "./generate.js";
import { sendMail } from "./mail.js";

const LIMITS = { name: 100, email: 254, body: 5000 };

// POST /api/contact: saved to `messages` and forwarded to the owner, reply-to the sender.
export async function handleContact(request, env, ctx) {
  let input;
  try {
    input = await request.json();
  } catch {
    input = null;
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return Response.json({ error: "Send the form as JSON." }, { status: 400 });

  if (!(await verifyTurnstile(env.TURNSTILE_SECRET, input.turnstile_token)))
    return Response.json({ error: "The human check failed. Please try again." }, { status: 403 });

  if (!(await withinLimit(env.RL_CONTACT, request)))
    return Response.json({ error: "Please wait a minute before sending another message." }, { status: 429 });

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body || name.length > LIMITS.name || email.length > LIMITS.email || body.length > LIMITS.body)
    return Response.json({ error: "Please add a valid email and a message." }, { status: 400 });

  await env.DB.prepare("INSERT INTO messages (name, email, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(name || null, email, body, new Date().toISOString())
    .run();
  ctx.waitUntil(
    sendMail(env, {
      subject: `Made Openly contact${name ? ` from ${name.replace(/[\r\n]+/g, " ")}` : ""}`,
      text: `${name || "(no name)"} <${email}>\n\n${body}`,
      replyTo: email,
    }),
  );
  return Response.json({ ok: true }, { status: 201 });
}
