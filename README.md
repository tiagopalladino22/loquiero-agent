# loquiero-agent — bot WhatsApp de LO QUIERO (v1)

Bot Hermes+GPT dedicado a LO QUIERO, **separado de Rumpel** (mismo patron que
`horsego-agent`: "un brain por negocio"). v1: toma "LO QUIERO A01", reserva el producto
en el ops center, ofrece punto de entrega, pasa el CVU y pide el comprobante.

## Estructura
- `prompts/PLATFORM_HINT.md` — la persona + el flujo v1 (lo que recibe el modelo).
- `prompts/TOOL-USE.md` — como el bot llama a la herramienta de reserva.
- `tools/reservar.mjs` — herramienta que corre el LLM: reserva un producto (RPC atomico).
  Probada. Imprime JSON `{ok:true, sku, precio, ...}` o `{ok:false, reason}`.
- `sync.sh` — pull del repo + reinicia el gateway (aplica cambios de prompt/adapter).
- `.env.example` — env del agente.

## En la base (ops center de LO QUIERO) — YA aplicado
- Estado `reservado` en el enum (entre `publicado` y `vendido`), + columnas
  `reservado_at` / `reservado_por`.
- RPC `reservar_producto(p_codigo, p_wa)`: si el producto esta `publicado` lo pasa a
  `reservado` de forma **atomica** (solo el primer "lo quiero" gana) y devuelve sus datos;
  si no, devuelve el motivo. (Definido en el repo `tuganga-ops`.)

## Antes de deployar: completar placeholders
En `prompts/PLATFORM_HINT.md`:
- `{{PUNTO_1}}` / `{{PUNTO_2}}` -> los puntos de entrega reales.
- `{{CVU}}` -> el CVU/alias real de LO QUIERO.

## Deploy en el VPS (como HorseGo, pero su propio gateway)
El bot corre en **su propio gateway** (puerto propio, ej `8649`) con **su propio webhook
de Kapso**, para no chocar con Rumpel ni HorseGo.

1. Clonar este repo en el VPS, ej `/opt/data/loquiero-agent`.
2. Env del agente (ver `.env.example`): `KAPSO_*` (con `KAPSO_PORT=8649` y el
   `KAPSO_PHONE_NUMBER_ID` del numero de LO QUIERO), `LOQUIERO_SUPABASE_URL` +
   `LOQUIERO_SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` + `LOQUIERO_MODEL`.
3. **Persona (la unica pieza de codigo a wirear, igual que hiciste en HorseGo):** en el
   adapter de Kapso de ESTE gateway, agregar una funcion que lea la persona de este repo
   y usarla como `platform_hint`. Es el mismo patron que `_horsego_platform_hint()`:

   ```python
   def _loquiero_platform_hint() -> str:
       repo = os.getenv("LOQUIERO_REPO_DIR", "/opt/data/loquiero-agent")
       try:
           subprocess.run(["git","-C",repo,"pull","--ff-only"],
                          check=False, capture_output=True, timeout=15)
       except Exception:
           pass
       parts = []
       for name in ("PLATFORM_HINT.md", "TOOL-USE.md"):
           try:
               with open(os.path.join(repo,"prompts",name),"r",encoding="utf-8") as fh:
                   parts.append(fh.read().strip())
           except Exception:
               pass
       return "\n\n".join(p for p in parts if p) or "Sos LO QUIERO en WhatsApp."
   ```
   Y en `register(...)`: `platform_hint=_loquiero_platform_hint(),`
4. Registrar el webhook en Kapso apuntando al puerto/host publico de este gateway
   (`/kapso/webhook`), con el numero de LO QUIERO.
5. Arrancar el gateway. Despues, cada cambio: editar prompts -> `git push` -> en el VPS
   `cd /opt/data/loquiero-agent && sh sync.sh` (reinicia el gateway con la persona nueva).

## Probar
Mandarle "LO QUIERO A6" por WhatsApp (o por Telegram si conectas ese canal para testear).
Deberia reservar A6 y preguntar el punto de entrega. Un segundo "LO QUIERO A6" desde otro
numero deberia recibir "ya lo reservo otra persona".

## Fuera de alcance de la v1 (siguiente paso)
- Verificar el monto del comprobante con vision (GPT) y pasar a `vendido` automatico.
- Auto-liberar la reserva a los 30-60 min si no llega el pago (pg_cron).
