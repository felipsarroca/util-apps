import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { escapeHtml, formatDate, htmlPage, libraryEmail, sendMail } from "../_shared/mailer.ts";

type LoanRow = {
  id: string;
  user_email: string;
  loaned_at: string;
  due_at: string | null;
  books: {
    title: string;
    author: string | null;
    location: string | null;
  } | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabase = createServiceClient();
  const today = startOfDay(new Date());
  const soon = addDays(today, 2);

  const { data: loans, error } = await supabase
    .from("loans")
    .select("id,user_email,loaned_at,due_at,books(title,author,location)")
    .eq("status", "actiu")
    .not("due_at", "is", null)
    .lte("due_at", toDate(soon));

  if (error) return json({ error: error.message }, 500);

  const sent: Array<Record<string, unknown>> = [];
  const skipped: Array<Record<string, unknown>> = [];
  const failed: Array<Record<string, unknown>> = [];

  for (const loan of (loans || []) as LoanRow[]) {
    const type = reminderType(loan, today);
    const alreadySent = await hasNotification(supabase, type, loan.user_email, loan.id);
    if (alreadySent) {
      skipped.push({ loan_id: loan.id, type, reason: "already_sent" });
      continue;
    }

    const subject = subjectFor(type, loan);
    const result = await sendMail({
      to: loan.user_email,
      subject,
      html: loanHtml(type, loan),
      text: `${subject}. Retorn previst: ${formatDate(loan.due_at)}.`,
      replyTo: libraryEmail
    });

    await logNotification(supabase, {
      notification_type: type,
      recipient_email: loan.user_email,
      loan_id: loan.id,
      subject,
      status: result.skipped ? "skipped" : result.ok ? "sent" : "failed",
      error_message: result.error || null,
      sent_at: result.ok && !result.skipped ? new Date().toISOString() : null
    });

    if (result.ok && !result.skipped) sent.push({ loan_id: loan.id, type, to: loan.user_email });
    else if (result.skipped) skipped.push({ loan_id: loan.id, type, reason: "email_not_configured" });
    else failed.push({ loan_id: loan.id, type, error: result.error });
  }

  const overdueLoans = ((loans || []) as LoanRow[]).filter((loan) => reminderType(loan, today) === "loan_overdue");
  if (overdueLoans.length) {
    await sendLibrarySummary(supabase, overdueLoans);
  }

  return json({ ok: true, sent, skipped, failed });
});

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

function reminderType(loan: LoanRow, today: Date) {
  const due = startOfDay(new Date(`${loan.due_at}T00:00:00`));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "loan_overdue";
  if (diffDays === 0) return "loan_due_today";
  return "loan_due_soon";
}

function subjectFor(type: string, loan: LoanRow) {
  const title = loan.books?.title || "llibre";
  if (type === "loan_overdue") return `Retorn pendent: ${title}`;
  if (type === "loan_due_today") return `Avui venç el préstec: ${title}`;
  return `Recordatori de retorn: ${title}`;
}

function loanHtml(type: string, loan: LoanRow) {
  const title = subjectFor(type, loan);
  const intro = type === "loan_overdue"
    ? "El termini de devolució d'aquest llibre ja ha vençut."
    : type === "loan_due_today"
      ? "Avui és la data prevista de retorn d'aquest llibre."
      : "Et recordem que aviat venç el termini de devolució d'aquest llibre.";

  return htmlPage(
    title,
    `
      <p>${escapeHtml(intro)}</p>
      <p><strong>Llibre:</strong> ${escapeHtml(loan.books?.title)}</p>
      <p><strong>Autor:</strong> ${escapeHtml(loan.books?.author || "")}</p>
      <p><strong>Data de préstec:</strong> ${formatDate(loan.loaned_at)}</p>
      <p><strong>Retorn previst:</strong> ${formatDate(loan.due_at)}</p>
      <p>Si necessites més temps, respon aquest correu per demanar una renovació.</p>
    `
  );
}

async function sendLibrarySummary(supabase: ReturnType<typeof createServiceClient>, loans: LoanRow[]) {
  const subject = `Préstecs amb retard: ${loans.length}`;
  const rows = loans.map((loan) => `
    <li>
      <strong>${escapeHtml(loan.books?.title)}</strong>
      · ${escapeHtml(loan.user_email)}
      · retorn previst ${formatDate(loan.due_at)}
      · ${escapeHtml(loan.books?.location || "ubicació pendent")}
    </li>
  `).join("");

  const alreadySent = await hasNotification(supabase, "library_overdue_summary", libraryEmail, null);
  if (alreadySent) return;

  const result = await sendMail({
    to: libraryEmail,
    subject,
    html: htmlPage("Resum de préstecs amb retard", `<ul>${rows}</ul>`),
    text: `${loans.length} préstecs amb retard.`
  });

  await supabase.from("email_notifications").insert({
    notification_type: "library_overdue_summary",
    recipient_email: libraryEmail,
    subject,
    status: result.skipped ? "skipped" : result.ok ? "sent" : "failed",
    error_message: result.error || null,
    sent_at: result.ok && !result.skipped ? new Date().toISOString() : null
  });
}

async function hasNotification(
  supabase: ReturnType<typeof createServiceClient>,
  type: string,
  recipient: string,
  loanId: string | null
) {
  let query = supabase
    .from("email_notifications")
    .select("id")
    .eq("notification_type", type)
    .eq("recipient_email", recipient)
    .in("status", ["sent", "skipped"]);

  if (loanId) query = query.eq("loan_id", loanId);
  else query = query.gte("created_at", toDate(startOfDay(new Date())));

  const { data } = await query.limit(1);
  return Boolean(data && data.length);
}

async function logNotification(supabase: ReturnType<typeof createServiceClient>, row: Record<string, unknown>) {
  await supabase.from("email_notifications").upsert(row, {
    onConflict: "notification_type,recipient_email,loan_id"
  });
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

