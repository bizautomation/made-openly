// Mail to the owner through Resend. Only the owner ever receives mail.
// Failures log the HTTP status only: never an address, a name or a message.

const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(env, { subject, text, replyTo }) {
  if (!env.RESEND_API_KEY || !env.ADMIN_EMAIL || !env.MAIL_FROM) return false;
  const payload = { from: env.MAIL_FROM, to: [env.ADMIN_EMAIL], subject, text };
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
