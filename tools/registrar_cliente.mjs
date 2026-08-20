#!/usr/bin/env node
// Herramienta del bot LO QUIERO: da de alta / registra un cliente que quiere sumarse.
// La llama el LLM del bot (Hermes) cuando alguien dice "me invitaron a sumarme al grupo".
//
//   node tools/registrar_cliente.mjs '{"nombre":"Ana","apellido":"Perez","ref":"MARTA","wa":"5491122334455"}'
//
// Llama al RPC registrar_cliente (upsert por wa_user_id, resuelve el referidor, no pisa
// la atribucion de un cliente ya existente) e imprime JSON. El bot responde segun el
// resultado.
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

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

if (!url || !key) {
  out({ ok: false, reason: "config", error: "Faltan LOQUIERO_SUPABASE_URL / _SERVICE_ROLE_KEY" });
  process.exit(0);
}

let arg = {};
const raw = process.argv[2] || "";
try {
  arg = JSON.parse(raw);
} catch {
  arg = { nombre: raw };
}

const nombre = String(arg.nombre || arg.name || "").trim();
const apellido = String(arg.apellido || arg.lastname || "").trim() || null;
// referidor: aceptar ref / referido_por / quien_invito. Si el codigo viene dentro de una
// frase ("me invitaron con este codigo: TIAGO21" o "ref:MARTA"), extraerlo; si no, usar el
// texto tal cual (puede ser un nombre).
let ref = String(arg.ref || arg.referidor || arg.referido_por || arg.quien_invito || "").trim();
const refMatch = ref.match(/(?:ref|c[oó]digo|cod)\s*[:=]\s*([A-Za-z0-9]+)/i);
if (refMatch) ref = refMatch[1];
ref = ref.trim() || null;
const wa = String(arg.wa || arg.phone || arg.telefono || "").replace(/[^\d]/g, "") || null;
const telefono = arg.telefono ? String(arg.telefono).trim() : null;

if (!nombre) {
  out({ ok: false, reason: "sin_nombre", error: "No vino nombre" });
  process.exit(0);
}

try {
  const res = await fetch(`${url}/rest/v1/rpc/registrar_cliente`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_nombre: nombre,
      p_apellido: apellido,
      p_ref: ref,
      p_wa: wa,
      p_telefono: telefono,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    out({ ok: false, reason: "rpc_error", status: res.status, error: json });
    process.exit(0);
  }
  out(json); // { ok:true, nuevo, ya_registrado, id, nombre, referidor, ref_no_encontrado } | { ok:false, reason }
} catch (e) {
  out({ ok: false, reason: "network", error: String(e.message || e) });
}
