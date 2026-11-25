#!/usr/bin/env bash
# Deploy disparado pelo GitHub Actions a cada push na main que passa no CI.
#
# Roda na VPS como "comando forçado" da chave de deploy (authorized_keys com restrict +
# command=), então a chave do GitHub não abre shell: só consegue executar este script.
# O SHA esperado chega em SSH_ORIGINAL_COMMAND e é validado antes de qualquer uso.
#
# Tudo fica dentro de main() e a chamada está na última linha: o bash lê o arquivo inteiro
# antes de executar, então o git pull pode atualizar este próprio script sem quebrar a rodada.
set -euo pipefail

main() {
  local raiz sha_esperado
  raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$raiz"

  log() { printf '[deploy-ci %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

  # Um deploy por vez (o workflow também usa concurrency, isto é a segunda trava).
  exec 9>/tmp/indicadores-br-deploy.lock
  flock -n 9 || { log "ERRO: já existe um deploy em andamento"; exit 1; }

  sha_esperado="${SSH_ORIGINAL_COMMAND:-}"
  if [[ -n "$sha_esperado" && ! "$sha_esperado" =~ ^[0-9a-f]{7,40}$ ]]; then
    log "ERRO: SHA inválido recebido"
    exit 2
  fi

  log "buscando a main no GitHub"
  git fetch --quiet origin main
  git merge --ff-only --quiet origin/main
  local atual
  atual="$(git rev-parse HEAD)"
  log "código em ${atual:0:7}"
  if [[ -n "$sha_esperado" ]] && ! git merge-base --is-ancestor "$sha_esperado" HEAD; then
    log "ERRO: o commit ${sha_esperado:0:7} não está na main da VPS"
    exit 3
  fi

  log "build e up"
  docker compose build --quiet
  docker compose up -d --remove-orphans --quiet-pull

  log "esperando Airflow e Farol"
  for _ in $(seq 1 30); do
    if "$raiz/scripts/healthcheck.sh" >/dev/null 2>&1 \
      && curl -fsS --max-time 5 http://127.0.0.1:3010/api/saude >/dev/null; then
      log "OK: Airflow saudável e Farol respondendo (${atual:0:7})"
      exit 0
    fi
    sleep 10
  done

  log "ERRO: serviços não ficaram saudáveis em 5 minutos"
  docker compose ps
  exit 1
}

main "$@"
