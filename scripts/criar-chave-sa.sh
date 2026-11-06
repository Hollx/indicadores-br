#!/usr/bin/env bash
# Gera a chave JSON de uma service account criada pelo Terraform.
# A chave fica fora do state do Terraform de propósito.
# Usa a configuração gcloud do portfólio (padrão: "pessoal"), nunca a configuração ativa.
#
# Uso: ./scripts/criar-chave-sa.sh [pipeline|dashboard]
#   pipeline  (padrão) secrets/sa.json            Airflow + dbt
#   dashboard          secrets/sa-dashboard.json  Evidence, só leitura na Gold
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

CONFIG="${GCLOUD_CONFIG:-pessoal}"
CONTA="${1:-pipeline}"

case "$CONTA" in
  pipeline)  output="service_account_email";           arquivo="secrets/sa.json" ;;
  dashboard) output="dashboard_service_account_email"; arquivo="secrets/sa-dashboard.json" ;;
  *) echo "Uso: $0 [pipeline|dashboard]" >&2; exit 1 ;;
esac

command -v terraform >/dev/null 2>&1 || { echo "terraform não encontrado" >&2; exit 1; }

# Mesmas checagens do Terraform: configuração existe, tem conta e aponta para o projeto do tfvars.
GCLOUD_CONFIG="$CONFIG" ./scripts/gcp-token.sh >/dev/null

email="$(terraform -chdir=terraform output -raw "$output")"
mkdir -p secrets
chmod 700 secrets

if [[ -f "$arquivo" ]]; then
  echo "$arquivo já existe. Apague-o antes se quiser gerar outra chave." >&2
  exit 1
fi

umask 077
gcloud iam service-accounts keys create "$arquivo" \
  --iam-account="$email" \
  --configuration="$CONFIG"
echo "Chave criada em $arquivo para $email"
