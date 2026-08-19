#!/usr/bin/env sh
# Aplica cambios del repo al agente LO QUIERO vivo (Hermes/Kapso) y reinicia el gateway.
# Mismo patron que horsego-agent/sync.sh. La persona vive en prompts/PLATFORM_HINT.md +
# prompts/TOOL-USE.md, y la herramienta en tools/reservar.mjs.
#
# Correr en el VPS como el usuario hermes:
#     cd /opt/data/loquiero-agent && sh sync.sh
# o por cron cada pocos minutos (es no-op si no hay commits nuevos).
#
# Que hace, idempotente y cron-safe:
#   1. git pull (fast-forward, best-effort).
#   2. Si el adapter vendorizado (si existe) difiere del plugin vivo -> syntax-check,
#      backup, copia, marca para reiniciar.
#   3. Si HEAD se movio este run -> marca para reiniciar (los prompts se leen al arrancar
#      el gateway, asi que un cambio de prompt se aplica reiniciando).
#   4. Reinicia el gateway solo si hay algo que aplicar.
set -e

REPO="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="${LOQUIERO_KAPSO_ADAPTER:-/opt/data/plugins/kapso/adapter.py}"
HEALTH_URL="${LOQUIERO_HEALTH_URL:-http://localhost:8649/health}"
VENDORED="$REPO/vendor/kapso/adapter.py"

before="$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo none)"
echo "==> git pull"
git -C "$REPO" pull --ff-only || echo "(pull failed or nothing to pull; continuing)"
after="$(git -C "$REPO" rev-parse HEAD 2>/dev/null || echo none)"
[ "$before" = "$after" ] || echo "==> new commits: $before -> $after"

need_restart=0
if [ -f "$VENDORED" ] && ! cmp -s "$VENDORED" "$PLUGIN"; then
  echo "==> adapter differs; validating syntax before copy"
  python3 -c "import ast; ast.parse(open('$VENDORED').read())" || { echo "FAIL: vendored adapter syntax error; not copying"; exit 1; }
  cp "$PLUGIN" "$PLUGIN.bak.$(date -u +%Y%m%dT%H%M%SZ)" 2>/dev/null || true
  cp "$VENDORED" "$PLUGIN"
  echo "==> adapter updated (backup kept)"
  need_restart=1
fi
[ "$before" != "$after" ] && need_restart=1

if [ "$need_restart" = "0" ]; then
  echo "==> nothing to apply"; exit 0
fi

echo "==> restarting gateway (safe replace)"
nohup hermes gateway run --replace --accept-hooks >/dev/null 2>&1 &
sleep 3
echo "==> health:"; curl -s "$HEALTH_URL" || echo "(no health response yet; check manually)"
echo "==> done"
