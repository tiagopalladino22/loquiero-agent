#!/usr/bin/env bash
set -euo pipefail
cd /opt/data/loquiero-agent
set -a
[ -f .env ] && . ./.env
set +a
node tools/notificar.mjs >> /tmp/loquiero-notif.log 2>&1
