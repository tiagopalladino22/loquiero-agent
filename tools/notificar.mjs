#!/usr/bin/env node
// Worker de notificaciones de LO QUIERO. Pensado para correr cada ~1 min en el bot (que ya
// es always-on y tiene Kapso). Sin dependencias: solo fetch.
//
//   node tools/notificar.mjs          # hace el trabajo real
//   node tools/notificar.mjs --dry    # no envia, solo muestra lo que mandaria
//
// Hace tres cosas:
//   1. libera las reservas vencidas y avanza la fila (encola avisos)   [respaldo de pg_cron]
//   2. confirma las recompensas cuya entrega ya cumplio los dias        [respaldo de pg_cron]
//   3. drena la cola `notificaciones` mandando el mensaje libre por WhatsApp (Kapso)
//
// Env (las mismas del bot + Kapso):
//   LOQUIERO_SUPABASE_URL, LOQUIERO_SUPABASE_SERVICE_ROLE_KEY
//   KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID (opcional), KAPSO_CLOUD_BASE / KAPSO_API_VERSION (opcionales)

const DRY = process.argv.includes("--dry");

const SB = (process.env.LOQUIERO_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.LOQUIERO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const KAPSO_BASE = process.env.KAPSO_CLOUD_BASE || "https://api.kapso.ai/meta/whatsapp";
const KAPSO_VER = process.env.KAPSO_API_VERSION || "v21.0";
const KAPSO_PHONE = process.env.KAPSO_PHONE_NUMBER_ID || "1225029507353077";
const KAPSO_KEY = process.env.KAPSO_API_KEY || "";

function log(o) {
  process.stdout.write((typeof o === "string" ? o : JSON.stringify(o)) + "\n");
}
if (!SB || !KEY) {
  log({ ok: false, error: "Faltan LOQUIERO_SUPABASE_URL / _SERVICE_ROLE_KEY" });
  process.exit(0);
}

const sbHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rpc(fn, body = {}) {
  const res = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: sbHeaders, body: JSON.stringify(body) });
  const t = await res.text();
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${t.slice(0, 200)}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function sendText(to, body) {
  const res = await fetch(`${KAPSO_BASE}/${KAPSO_VER}/${KAPSO_PHONE}/messages`, {
    method: "POST",
    headers: { "X-API-Key": KAPSO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body } }),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Kapso ${res.status}: ${t.slice(0, 300)}`);
  return t;
}

async function main() {
  // 1 + 2: respaldo de pg_cron (idempotente)
  let liberadas = 0, confirmadas = 0;
  try { liberadas = await rpc("liberar_reservas_vencidas"); } catch (e) { log(`warn liberar: ${e.message}`); }
  try { confirmadas = await rpc("confirmar_recompensas"); } catch (e) { log(`warn confirmar: ${e.message}`); }

  // 3: drenar pendientes
  const q = `${SB}/rest/v1/notificaciones?estado=eq.pendiente&intentos=lt.5&order=created_at.asc&limit=50`;
  const res = await fetch(q, { headers: sbHeaders });
  const pend = res.ok ? await res.json() : [];

  let enviadas = 0, fallidas = 0;
  for (const n of pend) {
    const to = String(n.wa_user_id || "").replace(/[^\d]/g, "");
    if (!to || !n.mensaje) {
      await rpc("marcar_notificacion", { p_id: n.id, p_estado: "error", p_error: "sin destino o mensaje" });
      fallidas++;
      continue;
    }
    if (DRY) { log(`[dry] -> ${to}: ${n.mensaje}`); enviadas++; continue; }
    try {
      await sendText(to, n.mensaje);
      await rpc("marcar_notificacion", { p_id: n.id, p_estado: "enviado", p_error: null });
      enviadas++;
    } catch (e) {
      await rpc("marcar_notificacion", { p_id: n.id, p_estado: "error", p_error: String(e.message || e).slice(0, 500) });
      fallidas++;
    }
  }

  log(`notificar: ${liberadas} liberada(s), ${confirmadas} recompensa(s) confirmada(s), ${enviadas} enviada(s)${DRY ? " (dry)" : ""}, ${fallidas} fallida(s).`);
}

main().catch((e) => { log({ ok: false, error: String(e.message || e) }); process.exit(0); });
