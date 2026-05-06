import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { escapeHtml, formatDate, htmlPage, libraryEmail, sendMail } from "../_shared/mailer.ts";

type ReservationPayload = {
  reservation_id?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const payload = await req.json().catch(() => ({})) as ReservationPayload;
  if (!payload.reservation_id) {
    return json({ error: "reservation_id is required" }, 400);
  }

  const supabase = createServiceClient();
  const { data: reservation, error } = await supabase
    .from("reservations")
    .select("id,user_email,requested_at,notes,books(title,author,location,available_copies,total_copies)")
    .eq("id", payload.reservation_id)
    .single();

  if (error || !reservation) {
    return json({ error: error?.message || "Reservation not found" }, 404);
  }

  const book = Array.isArray(reservation.books) ? reservation.books[0] : reservation.books;
  const subject = `Nova sol·licitud: ${book?.title || "llibre"}`;
  const html = htmlPage(
    "Nova sol·licitud de llibre",
    `
      <p><strong>Usuari:</strong> ${escapeHtml(reservation.user_email)}</p>
      <p><strong>Llibre:</strong> ${escapeHtml(book?.title)}</p>
      <p><strong>Autor:</strong> ${escapeHtml(book?.author)}</p>
      <p><strong>Ubicació:</strong> ${escapeHtml(book?.location || "Ubicació pendent")}</p>
      <p><strong>Disponibilitat:</strong> ${Number(book?.available_copies || 0)}/${Number(book?.total_copies || 0)}</p>
      <p><strong>Data de sol·licitud:</strong> ${formatDate(reservation.requested_at)}</p>
      ${reservation.notes ? `<p><strong>Notes:</strong> ${escapeHtml(reservation.notes)}</p>` : ""}
    `
  );

  const result = await sendMail({
    to: libraryEmail,
    subject,
    html,
    text: `Nova sol·licitud de ${reservation.user_email}: ${book?.title || ""}`,
    replyTo: reservation.user_email
  });

  await logNotification(supabase, {
    notification_type: "reservation_created",
    recipient_email: libraryEmail,
    reservation_id: reservation.id,
    subject,
    status: result.skipped ? "skipped" : result.ok ? "sent" : "failed",
    error_message: result.error || null,
    sent_at: result.ok && !result.skipped ? new Date().toISOString() : null
  });

  return json({ ok: result.ok, skipped: result.skipped || false, error: result.error || null });
});

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

async function logNotification(supabase: ReturnType<typeof createServiceClient>, row: Record<string, unknown>) {
  await supabase.from("email_notifications").upsert(row, {
    onConflict: "notification_type,recipient_email,reservation_id"
  });
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

