import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-keep-alive-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Metode no permes." }, 405);

  const expectedToken = Deno.env.get("GESTIO_KEEP_ALIVE_TOKEN");
  const requestToken = req.headers.get("x-keep-alive-token") ?? "";

  if (!expectedToken || requestToken !== expectedToken) {
    return json({ error: "No autoritzat." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("GESTIO_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Falten secrets de Supabase a la funcio." }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { count, error } = await adminClient
    .from("usuaris")
    .select("id", { count: "exact", head: true });

  if (error) return json({ error: error.message }, 500);

  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    table: "usuaris",
    count,
  });
});
