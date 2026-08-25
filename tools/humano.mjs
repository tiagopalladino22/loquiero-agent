#!/usr/bin/env node
// Herramienta del bot LO QUIERO: devuelve el link de WhatsApp para derivar a un humano
// cuando el cliente pide hablar con una persona. El numero se configura en el ops center
// (Ajustes -> "Hablar con un humano", config.humano_wa), asi se cambia sin tocar el bot.
//
//   node tools/humano.mjs
//
// Imprime JSON: { ok, wa, link }. El bot manda el link tal cual.
//
// Env (en el VPS): LOQUIERO_SUPABASE_URL + LOQUIERO_SUPABASE_SERVICE_ROLE_KEY
//   (fallback a SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).

const url = (
  process.env.LOQUIERO_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const key =
  process.env.LOQUIERO_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

// Numero por defecto si no se pudo leer la config (para no dejar al cliente sin salida).
const DEFAULT_WA = "5491166568379";

function out(wa) {
  const digits = String(wa || "").replace(/[^\d]/g, "") || DEFAULT_WA;
  process.stdout.write(JSON.stringify({ ok: true, wa: digits, link: `https://wa.me/${digits}` }) + "\n");
}

if (!url || !key) {
  out(DEFAULT_WA);
  process.exit(0);
}

try {
  const res = await fetch(`${url}/rest/v1/config?key=eq.humano_wa&select=value`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    out(DEFAULT_WA);
    process.exit(0);
  }
  const rows = await res.json();
  const val = Array.isArray(rows) && rows[0] ? rows[0].value : null;
  out(val ?? DEFAULT_WA);
} catch {
  out(DEFAULT_WA);
}
