#!/usr/bin/env node
// Crea la plantilla "pedido_reservado" en la cuenta de WhatsApp (WABA) del bot de un grupo.
// La usan los grupos con pedidos desde el grupo: es el primer mensaje del bot a quien escribió
// QUIERO en el grupo (o a quien le toca en la fila). Meta la revisa: de minutos a un día.
// La arma plantilla_pedido() en la base (tuganga-ops, scripts/migrate-pedidos-grupo.mjs);
// si se cambia el texto acá, los parámetros tienen que seguir siendo los mismos.
//
//   KAPSO_WABA_ID=... node tools/crear-plantilla.mjs          # crea
//   KAPSO_WABA_ID=... node tools/crear-plantilla.mjs --estado # muestra si ya está aprobada
//
// Env: KAPSO_API_KEY, KAPSO_WABA_ID (WhatsApp Business Account id del número del bot, en Kapso).
const KAPSO_BASE = process.env.KAPSO_CLOUD_BASE || "https://api.kapso.ai/meta/whatsapp";
const KAPSO_VER = process.env.KAPSO_API_VERSION || "v21.0";
const KEY = process.env.KAPSO_API_KEY || "";
const WABA = process.env.KAPSO_WABA_ID || "";
if (!KEY || !WABA) {
  console.log(JSON.stringify({ ok: false, error: "Faltan KAPSO_API_KEY / KAPSO_WABA_ID" }));
  process.exit(1);
}
const url = `${KAPSO_BASE}/${KAPSO_VER}/${WABA}/message_templates`;
const headers = { "X-API-Key": KEY, "Content-Type": "application/json" };

if (process.argv.includes("--estado")) {
  const r = await fetch(`${url}?name=pedido_reservado`, { headers });
  console.log(r.status, await r.text());
  process.exit(0);
}

const plantilla = {
  name: "pedido_reservado",
  language: "es_AR",
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Hola! Te reservamos {{1}} por {{2}} minutos. Tocá el botón para completar tus datos y el pago.",
      example: { body_text: [["A28 · Vestido negro (talle S)", "15"]] },
    },
    {
      type: "BUTTONS",
      buttons: [{
        type: "URL",
        text: "Completar compra",
        url: "https://loquiero.systeems.com/c/{{1}}",
        example: ["https://loquiero.systeems.com/c/1ddbd4180d4542809305?wa=5491100000000"],
      }],
    },
  ],
};
const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(plantilla) });
console.log(r.status, await r.text());
