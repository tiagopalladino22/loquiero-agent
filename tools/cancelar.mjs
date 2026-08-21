#!/usr/bin/env node
// Herramienta del bot LO QUIERO: cancela la reserva del cliente cuando se arrepiente
// ("no lo quiero", "cancelame", "me arrepenti"). Libera el producto y, si hay fila,
// se lo re-reserva al siguiente y le encola el aviso (lo manda el worker notificar).
//
//   node tools/cancelar.mjs '{"wa":"5491122334455"}'
//
// Llama al RPC cancelar_reserva(p_wa). Imprime JSON; el bot responde segun el resultado.
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
  arg = { wa: raw };
}
const wa = arg.wa || arg.phone || null;

if (!wa) {
  out({ ok: false, reason: "sin_wa", error: "No vino el numero del cliente" });
  process.exit(0);
}

try {
  const res = await fetch(`${url}/rest/v1/rpc/cancelar_reserva`, {
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
  out(json); // { ok:true, cancelado:true, codigo, descripcion, siguiente_notificado } | { ok:false, reason:"sin_reserva" }
} catch (e) {
  out({ ok: false, reason: "network", error: String(e.message || e) });
}
