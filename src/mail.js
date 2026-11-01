// Mail through Resend. The owner receives the review email and contact
// messages; a maker may ask for their badge key once (SPEC.md 8.5), and that
// address is used for the one send and never stored.
// Failures log the HTTP status only: never an address, a name or a message.

const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(env, { subject, text, replyTo, to }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !(to ?? env.ADMIN_EMAIL)) return false;
  const payload = { from: env.MAIL_FROM, to: [to ?? env.ADMIN_EMAIL], subject, text };
  if (replyTo) payload.reply_to = replyTo;
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.log("mail failed", res.status);
    return res.ok;
  } catch {
    console.log("mail failed", "network");
    return false;
  }
}
