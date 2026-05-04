import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const roleFromUser = (user: { app_metadata?: Record<string, unknown> }) =>
  user.app_metadata?.role ??
  user.app_metadata?.access_role ??
  null;

const cleanUser = (user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  banned_until?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
}) => ({
  id: user.id,
  email: user.email,
  role: roleFromUser(user),
  disabled: Boolean(user.banned_until),
  createdAt: user.created_at,
  lastSignInAt: user.last_sign_in_at,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metode no permes." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("GESTIO_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Falten secrets de Supabase a la funcio." }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: currentUserData, error: currentUserError } = await userClient.auth.getUser();
  if (currentUserError || !currentUserData.user) return json({ error: "Cal iniciar sessio." }, 401);
  if (roleFromUser(currentUserData.user) !== "edicio") {
    return json({ error: "Nomes els usuaris amb rol d'edicio poden administrar accessos." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cos de peticio invalid." }, 400);
  }

  const action = body.action;

  try {
    if (action === "list") {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      return json({
        users: data.users
          .map(cleanUser)
          .sort((a, b) => String(a.email ?? "").localeCompare(String(b.email ?? ""))),
      });
    }

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "consulta");
      if (!email) return json({ error: "Cal indicar un correu." }, 400);
      if (password.length < 8) return json({ error: "La contrasenya ha de tenir com a minim 8 caracters." }, 400);
      if (!["consulta", "edicio"].includes(role)) return json({ error: "Rol no valid." }, 400);

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
      });
      if (error) throw error;
      return json({ user: data.user ? cleanUser(data.user) : null });
    }

    if (action === "update-role") {
      const userId = String(body.userId ?? "");
      const role = String(body.role ?? "");
      if (!userId) return json({ error: "Falta l'identificador de l'usuari." }, 400);
      if (!["consulta", "edicio"].includes(role)) return json({ error: "Rol no valid." }, 400);

      const { data: existing, error: existingError } = await adminClient.auth.admin.getUserById(userId);
      if (existingError) throw existingError;

      const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
        app_metadata: { ...(existing.user.app_metadata ?? {}), role },
      });
      if (error) throw error;
      return json({ user: data.user ? cleanUser(data.user) : null });
    }

    if (action === "set-disabled") {
      const userId = String(body.userId ?? "");
      const disabled = Boolean(body.disabled);
      if (!userId) return json({ error: "Falta l'identificador de l'usuari." }, 400);
      if (userId === currentUserData.user.id) return json({ error: "No pots desactivar el teu propi acces." }, 400);

      const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
        ban_duration: disabled ? "876000h" : "none",
      });
      if (error) throw error;
      return json({ user: data.user ? cleanUser(data.user) : null });
    }

    if (action === "delete") {
      const userId = String(body.userId ?? "");
      if (!userId) return json({ error: "Falta l'identificador de l'usuari." }, 400);
      if (userId === currentUserData.user.id) return json({ error: "No pots eliminar el teu propi acces." }, 400);

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Accio no reconeguda." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error inesperat." }, 500);
  }
});
