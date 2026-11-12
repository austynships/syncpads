import { Resend } from "resend";

type Email = { to: string; subject: string; text: string; html: string };

let resend: Resend | null = null;

/**
 * Sends an email through Resend.
 * In development without RESEND_API_KEY, the email is printed to the console
 * instead, so you can click the link from the terminal.
 */
export async function sendEmail(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.log(`\n[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text}\n`);
    return;
  }

  resend ??= new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "SyncPads <no-reply@syncpads.com>",
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

/** Simple one-button email body. */
export function linkEmail(opts: { heading: string; body: string; buttonText: string; url: string }) {
  const text = `${opts.heading}\n\n${opts.body}\n\n${opts.url}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${opts.heading}</h2>
      <p>${opts.body}</p>
      <p><a href="${opts.url}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none;">${opts.buttonText}</a></p>
      <p style="color:#666;font-size:13px;">Or paste this link into your browser:<br>${opts.url}</p>
      <p style="color:#666;font-size:13px;">If you didn't request this, you can ignore this email.</p>
    </div>`;
  return { text, html };
}

