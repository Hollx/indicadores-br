#!/usr/bin/env bash
# Atualiza o código, reconstrói a imagem e sobe os serviços; espera o Airflow ficar saudável.
# Uso: ./scripts/deploy.sh [--sem-pull]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

log() { printf '[deploy] %s\n' "$*"; }

[[ -f .env ]] || { echo "[deploy] ERRO: .env ausente; rode scripts/bootstrap-vps.sh" >&2; exit 1; }
[[ -f secrets/sa.json ]] || { echo "[deploy] ERRO: secrets/sa.json ausente" >&2; exit 1; }

if [[ "${1:-}" != "--sem-pull" ]]; then
  log "git pull"
  git pull --ff-only
fi

log "build e up"
docker compose build
docker compose up -d

log "aguardando o Airflow responder"
for _ in $(seq 1 30); do
  if "$RAIZ/scripts/healthcheck.sh" >/dev/null 2>&1; then
    log "Airflow saudável."
    exit 0
  fi
  sleep 10
done

echo "[deploy] ERRO: Airflow não ficou saudável em 5 minutos. Veja: docker compose logs" >&2
exit 1
