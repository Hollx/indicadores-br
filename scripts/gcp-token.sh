#!/usr/bin/env bash
# Imprime um access token da configuração gcloud do portfólio (padrão: "pessoal").
#
# Antes, confere que a configuração existe, tem conta logada e aponta para o MESMO projeto
# do terraform/terraform.tfvars. Assim o Terraform nunca roda com outra conta ou projeto por engano,
# e a credencial global (application-default) da máquina não é usada nem alterada.
#
# Uso: GCLOUD_CONFIG=pessoal ./scripts/gcp-token.sh
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="${GCLOUD_CONFIG:-pessoal}"
TFVARS="$RAIZ/terraform/terraform.tfvars"

erro() { printf '[gcp] ERRO: %s\n' "$*" >&2; exit 1; }

command -v gcloud >/dev/null 2>&1 || erro "gcloud não encontrado."

gcloud config configurations describe "$CONFIG" >/dev/null 2>&1 \
  || erro "configuração '$CONFIG' não existe. Crie com: gcloud config configurations create $CONFIG && gcloud auth login"

conta="$(gcloud config get-value account --configuration="$CONFIG" 2>/dev/null || true)"
[[ -n "$conta" ]] || erro "configuração '$CONFIG' sem conta. Rode: gcloud config configurations activate $CONFIG && gcloud auth login"

projeto_cfg="$(gcloud config get-value project --configuration="$CONFIG" 2>/dev/null || true)"
[[ -n "$projeto_cfg" ]] || erro "configuração '$CONFIG' sem projeto. Rode: gcloud config set project SEU-PROJETO --configuration=$CONFIG"

[[ -f "$TFVARS" ]] || erro "terraform/terraform.tfvars não encontrado (copie de terraform.tfvars.example)."
projeto_tf="$(sed -n 's/^[[:space:]]*project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$TFVARS")"
[[ -n "$projeto_tf" ]] || erro "project_id não encontrado em terraform/terraform.tfvars."

[[ "$projeto_cfg" == "$projeto_tf" ]] \
  || erro "a configuração '$CONFIG' aponta para '$projeto_cfg', mas o terraform.tfvars usa '$projeto_tf'. Corrija um dos dois."

printf '[gcp] conta %s, projeto %s (configuração %s)\n' "$conta" "$projeto_tf" "$CONFIG" >&2
gcloud auth print-access-token --configuration="$CONFIG"
