#!/usr/bin/env bash
# Dump comprimido do banco de metadados do Airflow, com retenção por dias.
# Uso: ./scripts/backup-airflow-db.sh   (RETENCAO_DIAS=7 por padrão)
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

RETENCAO_DIAS="${RETENCAO_DIAS:-7}"
DESTINO="backups"
ARQUIVO="${DESTINO}/airflow-$(date +%Y-%m-%d_%H%M).sql.gz"

mkdir -p "$DESTINO"

# pipefail garante que uma falha no pg_dump não gere um backup vazio "com sucesso".
docker compose exec -T postgres pg_dump -U airflow --clean --if-exists airflow | gzip > "$ARQUIVO"

if [[ ! -s "$ARQUIVO" ]]; then
  echo "[backup] ERRO: arquivo vazio: $ARQUIVO" >&2
  rm -f "$ARQUIVO"
  exit 1
fi

find "$DESTINO" -name 'airflow-*.sql.gz' -type f -mtime +"$RETENCAO_DIAS" -delete

printf '[backup] %s (%s)\n' "$ARQUIVO" "$(du -h "$ARQUIVO" | cut -f1)"
