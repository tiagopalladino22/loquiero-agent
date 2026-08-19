#!/usr/bin/env node
// Herramienta del bot LO QUIERO: le devuelve a un cliente su link de referido.
// La llama el LLM cuando un cliente ya registrado pide "pasame mi link" / "quiero invitar".
//
//   node tools/mi_link.mjs '{"wa":"5491122334455"}'
//
// Busca al cliente por su WhatsApp (RPC mi_link), arma el mensaje pre-escrito con su codigo
// y el link wa.me al bot, e imprime JSON. El bot le manda el link tal cual.
//
// Env (en el VPS): LOQUIERO_SUPABASE_URL + LOQUIERO_SUPABASE_SERVICE_ROLE_KEY.

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
  arg = { wa: raw };
}
const wa = String(arg.wa || arg.phone || arg.telefono || raw || "").replace(/[^\d]/g, "");

if (!wa) {
  out({ ok: false, reason: "sin_wa", error: "No vino el numero del cliente" });
  process.exit(0);
}

// Mensaje pre-escrito que va a mandar el invitado (con el codigo del referidor adentro).
function mensajeInvitacion(codigo) {
  return `Hola, me quiero sumar al grupo de LO QUIERO, me invitaron con este codigo: ${codigo}`;
}

try {
  const res = await fetch(`${url}/rest/v1/rpc/mi_link`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_wa: wa }),
  });
  const json = await res.json();
  if (!res.ok) {
    out({ ok: false, reason: "rpc_error", status: res.status, error: json });
    process.exit(0);
  }
  if (!json || json.ok !== true) {
    out(json || { ok: false, reason: "no_existe" }); // { ok:false, reason:"no_existe"|"sin_wa" }
    process.exit(0);
  }
  const mensaje = mensajeInvitacion(json.codigo);
  const botWa = String(json.bot_wa || "").replace(/[^\d]/g, "");
  const link = botWa
    ? `https://wa.me/${botWa}?text=${encodeURIComponent(mensaje)}`
    : null;
  out({
    ok: true,
    nombre: json.nombre,
    codigo: json.codigo,
    mensaje,
    link, // null si falta el numero del bot en Config (config.bot_wa)
  });
} catch (e) {
  out({ ok: false, reason: "network", error: String(e.message || e) });
}
