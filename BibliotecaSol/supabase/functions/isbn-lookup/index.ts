import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Consulta Google Books amb la clau desada com a secret de Supabase
// (GOOGLE_BOOKS_API_KEY), perquè la clau no quedi exposada al navegador.

type LookupPayload = {
  isbn?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const payload = await req.json().catch(() => ({})) as LookupPayload;
  const isbn = String(payload.isbn || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) {
    return json({ error: "ISBN no vàlid" }, 400);
  }

  const apiKey = Deno.env.get("GOOGLE_BOOKS_API_KEY") || "";
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!response || !response.ok) {
    return json({ found: false, error: `Google Books no respon (${response?.status || "sense connexió"})` }, 200);
  }

  const data = await response.json().catch(() => null);
  const item = data?.items?.[0];
  const info = item?.volumeInfo;
  if (!info) {
    return json({ found: false }, 200);
  }

  return json({
    found: true,
    title: info.title || "",
    subtitle: info.subtitle || "",
    authors: Array.isArray(info.authors) ? info.authors : [],
    publisher: info.publisher || "",
    publishedDate: info.publishedDate || "",
    pageCount: Number(info.pageCount) || null,
    description: info.description || "",
    language: info.language || "",
    categories: Array.isArray(info.categories) ? info.categories : [],
    thumbnail: info.imageLinks?.thumbnail || ""
  });
});

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
