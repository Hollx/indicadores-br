#!/usr/bin/env bash
# Prepara a VPS para rodar o pipeline: checa o Docker, cria as pastas e gera o .env.
# Idempotente: pode rodar de novo sem sobrescrever um .env existente.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

log() { printf '[bootstrap] %s\n' "$*"; }
erro() { printf '[bootstrap] ERRO: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || erro "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || erro "Plugin 'docker compose' não encontrado."
command -v openssl >/dev/null 2>&1 || erro "openssl não encontrado (usado para gerar senhas)."

for pasta in data logs secrets backups; do
  mkdir -p "$pasta"
done
chmod 700 secrets

# O Airflow não deve rodar como root no container. Se o bootstrap roda como root,
# usa o UID padrão da imagem (50000) e dá a ele as pastas que o container escreve/lê.
if [[ "$(id -u)" -eq 0 ]]; then
  airflow_uid=50000
  chown -R "${airflow_uid}:0" data logs secrets
else
  airflow_uid="$(id -u)"
fi

if [[ -f .env ]]; then
  log ".env já existe, mantendo."
else
  cp .env.example .env
  senha_pg="$(openssl rand -hex 24)"
  jwt="$(openssl rand -hex 32)"
  sed -i \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${senha_pg}/" \
    -e "s/^AIRFLOW_JWT_SECRET=.*/AIRFLOW_JWT_SECRET=${jwt}/" \
    -e "s/^AIRFLOW_UID=.*/AIRFLOW_UID=${airflow_uid}/" \
    .env
  chmod 600 .env
  log ".env criado com senhas aleatórias. Edite GCP_PROJECT_ID antes de subir."
fi

if [[ ! -f secrets/sa.json ]]; then
  log "Aviso: secrets/sa.json não encontrado. Gere com scripts/criar-chave-sa.sh e copie para a VPS."
fi

log "Pronto. Próximo passo: make up"
