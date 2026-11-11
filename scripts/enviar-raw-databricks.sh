#!/usr/bin/env bash
# Envia a partição mais recente de data/raw/sgs para o Volume do Databricks.
# A Free Edition não acessa a API do BC, então a Bronze chega por upload.
# Uso: ./scripts/enviar-raw-databricks.sh [catalogo] [schema]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CATALOGO="${1:-workspace}"
SCHEMA="${2:-indicadores}"

log() { printf '[databricks] %s\n' "$*"; }

command -v databricks >/dev/null || { echo "[databricks] ERRO: instale a Databricks CLI" >&2; exit 1; }

ULTIMA="$(find "$RAIZ/data/raw/sgs" -maxdepth 1 -type d -name 'dt=*' | sort | tail -1)"
[[ -n "$ULTIMA" ]] || { echo "[databricks] ERRO: nenhuma partição em data/raw/sgs" >&2; exit 1; }

log "garantindo schema ${CATALOGO}.${SCHEMA} e volumes raw e artifacts"
databricks schemas create "$SCHEMA" "$CATALOGO" >/dev/null 2>&1 || true
databricks volumes create "$CATALOGO" "$SCHEMA" raw MANAGED >/dev/null 2>&1 || true
databricks volumes create "$CATALOGO" "$SCHEMA" artifacts MANAGED >/dev/null 2>&1 || true

DESTINO="dbfs:/Volumes/${CATALOGO}/${SCHEMA}/raw/sgs/$(basename "$ULTIMA")"
log "enviando $(basename "$ULTIMA") -> $DESTINO"
databricks fs cp --recursive --overwrite "$ULTIMA" "$DESTINO"

# O catálogo de séries (seed do dbt) vai para o mesmo Volume: o job serverless
# lê do Volume, não dos arquivos do workspace.
log "enviando catálogo de séries"
databricks fs cp --overwrite "$RAIZ/dbt/seeds/series_sgs.csv" \
  "dbfs:/Volumes/${CATALOGO}/${SCHEMA}/raw/series_sgs.csv"
log "ok"
