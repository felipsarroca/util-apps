export type MailResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export const libraryEmail = Deno.env.get("LIBRARY_EMAIL") || "biblioteca@ramonpont.cat";

export async function sendMail(input: SendMailInput): Promise<MailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");

  if (!apiKey || !from) {
    console.warn("Email skipped: RESEND_API_KEY or RESEND_FROM is not configured.");
    return { ok: true, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || libraryEmail
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { ok: false, error };
  }

  return { ok: true };
}

export function htmlPage(title: string, body: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.45;">
      <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(title)}</h1>
      ${body}
      <p style="margin-top: 20px; color: #667085; font-size: 13px;">Biblioteca de la Sol · Escola Ramon Pont</p>
    </div>
  `;
}

export function escapeHtml(value: unknown) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Sense data";
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

