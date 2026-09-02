#!/usr/bin/env node
// Herramienta del bot LO QUIERO: guarda en la compra el punto de entrega y/o el DNI que el
// cliente pasa durante el flujo de compra. Solo pisa el campo que viene (el otro queda igual).
//
//   node tools/guardar-datos-entrega.mjs '{"wa":"549...","sku":"A01","punto":"Palermo"}'
//   node tools/guardar-datos-entrega.mjs '{"wa":"549...","sku":"A01","dni":"30123456"}'
//
// Llama al RPC guardar_datos_entrega (busca la compra del producto y actualiza punto/dni).
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
try {
  arg = JSON.parse(process.argv[2] || "{}");
} catch {
  arg = {};
}
const wa = String(arg.wa || arg.phone || "").replace(/[^\d]/g, "") || null;
const sku = String(arg.sku || arg.codigo || "").trim() || null;
const punto = arg.punto != null ? String(arg.punto).trim() : null;
const dni = arg.dni != null ? String(arg.dni).trim() : null;

if (!sku) {
  out({ ok: false, reason: "sin_sku" });
  process.exit(0);
}

try {
  const res = await fetch(`${url}/rest/v1/rpc/guardar_datos_entrega`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_wa: wa, p_sku: sku, p_punto: punto, p_dni: dni }),
  });
  const json = await res.json();
  if (!res.ok) {
    out({ ok: false, reason: "rpc_error", status: res.status, error: json });
    process.exit(0);
  }
  out(json); // { ok:true, compra_id } | { ok:false, reason }
} catch (e) {
  out({ ok: false, reason: "network", error: String(e.message || e) });
}
