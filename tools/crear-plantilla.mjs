#!/usr/bin/env node
// Crea las plantillas de pedidos desde el grupo en la cuenta de WhatsApp (WABA) del bot de un
// grupo. Son el primer mensaje del bot a alguien que solo escribió en el grupo:
//   pedido_reservado  a quien escribió QUIERO (o a quien le toca en la fila)
//   pedido_en_fila    a quien escribió QUIERO y ya la tenía otra persona: su lugar en la fila
//   aviso_codigo      a quien escribió otra cosa: cómo pedir y a qué número consultar
//   reserva_confirmada  igual que pedido_reservado, redactada como utilidad (la otra quedó
//                       marketing); se usa cargando config plantilla_reserva
//   consulta_producto   a quien preguntó citando una foto (medidas, talle): link del producto;
//                       se usa cargando config plantilla_consulta (migrate-grupo-libero)
// Meta las revisa: de minutos a un día. Las arman plantilla_pedido(), plantilla_fila() y
// plantilla_aviso() en la
// base (tuganga-ops, scripts/migrate-pedidos-grupo.mjs); si se cambia el texto acá, los
// parámetros tienen que seguir siendo los mismos.
//
//   KAPSO_WABA_ID=... node tools/crear-plantilla.mjs          # crea
//   KAPSO_WABA_ID=... node tools/crear-plantilla.mjs --estado # muestra si ya están aprobadas
//   KAPSO_WABA_ID=... node tools/crear-plantilla.mjs --solo reserva_confirmada,consulta_producto
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
  for (const name of ["pedido_reservado", "pedido_en_fila", "aviso_codigo", "reserva_confirmada", "consulta_producto"]) {
    const r = await fetch(`${url}?name=${name}`, { headers });
    console.log(name, r.status, await r.text());
  }
  process.exit(0);
}

const pedido = {
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
const fila = {
  name: "pedido_en_fila",
  language: "es_AR",
  category: "UTILITY",
  components: [{
    type: "BODY",
    text: "Hola! {{1}} ya está reservada por otra persona. Te anotamos en la fila de espera: sos el número {{2}}. Si se libera, te escribimos.",
    example: { body_text: [["A28 · Vestido negro (talle S)", "1"]] },
  }],
};
const aviso = {
  name: "aviso_codigo",
  language: "es_AR",
  category: "UTILITY",
  components: [{
    type: "BODY",
    text: "Hola! Si quisiste pedir un producto, recordá que tenés que escribir QUIERO y el código (por ejemplo QUIERO A28) o responder \"quiero\" a la publicación. Cualquier otra consulta la podés hacer a este número: {{1}}. Gracias!",
    example: { body_text: [["https://wa.me/5491100000000"]] },
  }],
};
const reserva = {
  name: "reserva_confirmada",
  language: "es_AR",
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Tu pedido de {{1}} quedó reservado. Para confirmarlo, completá tus datos y el pago en los próximos {{2}} minutos desde el botón.",
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
const consulta = {
  name: "consulta_producto",
  language: "es_AR",
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Esta es la info de {{1}} que consultaste en el grupo: fotos, medidas y talle en el botón.",
      example: { body_text: [["A28 · Vestido negro (talle S)"]] },
    },
    {
      type: "BUTTONS",
      buttons: [{
        type: "URL",
        text: "Ver producto",
        url: "https://loquiero.systeems.com/c/{{1}}",
        example: ["https://loquiero.systeems.com/c/1ddbd4180d4542809305?wa=5491100000000"],
      }],
    },
  ],
};
const i = process.argv.indexOf("--solo");
const solo = i > 0 ? process.argv[i + 1].split(",") : null;
for (const plantilla of [pedido, fila, aviso, reserva, consulta].filter((x) => !solo || solo.includes(x.name))) {
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(plantilla) });
  console.log(plantilla.name, r.status, await r.text());
}
