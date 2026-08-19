#!/usr/bin/env node
// Herramienta del bot TU GANGA: reserva un producto por su codigo.
// La llama el LLM del bot (Hermes) cuando un cliente dice "LO QUIERO <codigo>".
//
//   node tools/reservar.mjs '{"codigo":"A01","wa":"5491122334455"}'
//
// Llama al RPC atomico reservar_producto (publicado -> reservado, solo el primero gana)
// e imprime JSON. El bot lee ese JSON y responde segun el resultado.
//
// Env (en el VPS): TUGANGA_SUPABASE_URL + TUGANGA_SUPABASE_SERVICE_ROLE_KEY
//   (fallback a SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).

const url = (
  process.env.TUGANGA_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const key =
  process.env.TUGANGA_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

if (!url || !key) {
  out({ ok: false, reason: "config", error: "Faltan TUGANGA_SUPABASE_URL / _SERVICE_ROLE_KEY" });
  process.exit(0);
}

// Parsear el argumento (JSON) o, si viene texto suelto, extraer el codigo tipo A01.
let arg = {};
const raw = process.argv[2] || "";
try {
  arg = JSON.parse(raw);
} catch {
  arg = { codigo: raw };
}
let codigo = String(arg.codigo || arg.code || raw || "").trim();
// Si viene con palabras ("LO QUIERO A6", "quiero el A01"), extraer el SKU tipo A01.
if (/\s/.test(codigo)) {
  const m = codigo.match(/\b([A-Za-z]{1,3}\s?\d{1,4})\b/);
  if (m) codigo = m[1].replace(/\s+/g, "");
}
// El RPC compara con lower() en ambos lados, asi que el case no importa.
const wa = arg.wa || arg.phone || null;

if (!codigo) {
  out({ ok: false, reason: "sin_codigo", error: "No vino codigo" });
  process.exit(0);
}

try {
  const res = await fetch(`${url}/rest/v1/rpc/reservar_producto`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_codigo: codigo, p_wa: wa }),
  });
  const json = await res.json();
  if (!res.ok) {
    out({ ok: false, reason: "rpc_error", status: res.status, error: json });
    process.exit(0);
  }
  out(json); // { ok:true, sku, descripcion, precio, talle, color, foto_jpg_url } | { ok:false, reason }
} catch (e) {
  out({ ok: false, reason: "network", error: String(e.message || e) });
}
