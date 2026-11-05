#!/usr/bin/env bash
# Gera a chave JSON da service account criada pelo Terraform em secrets/sa.json.
# A chave fica fora do state do Terraform de propósito.
# Usa a configuração gcloud do portfólio (padrão: "pessoal"), nunca a configuração ativa.
#
# Uso: GCLOUD_CONFIG=pessoal ./scripts/criar-chave-sa.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

CONFIG="${GCLOUD_CONFIG:-pessoal}"

command -v terraform >/dev/null 2>&1 || { echo "terraform não encontrado" >&2; exit 1; }

# Mesmas checagens do Terraform: configuração existe, tem conta e aponta para o projeto do tfvars.
GCLOUD_CONFIG="$CONFIG" ./scripts/gcp-token.sh >/dev/null

email="$(terraform -chdir=terraform output -raw service_account_email)"
mkdir -p secrets
chmod 700 secrets

if [[ -f secrets/sa.json ]]; then
  echo "secrets/sa.json já existe. Apague-o antes se quiser gerar outra chave." >&2
  exit 1
fi

umask 077
gcloud iam service-accounts keys create secrets/sa.json \
  --iam-account="$email" \
  --configuration="$CONFIG"
echo "Chave criada em secrets/sa.json para $email"
