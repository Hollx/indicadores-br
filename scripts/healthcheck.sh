#!/usr/bin/env bash
# Checa a saúde do Airflow (metadatabase e scheduler). Sai com código 1 se algo não estiver saudável.
# Feito para cron: imprime uma linha com timestamp e status.
set -euo pipefail

URL="${AIRFLOW_HEALTH_URL:-http://127.0.0.1:8080/api/v2/monitor/health}"
agora="$(date -Iseconds)"

if ! resposta="$(curl -fsS --max-time 10 "$URL")"; then
  echo "$agora FALHA api-server não respondeu em $URL"
  exit 1
fi

status="$(python3 - "$resposta" <<'PY'
import json, sys
dados = json.loads(sys.argv[1])
ruins = [nome for nome, info in dados.items()
         if isinstance(info, dict) and info.get("status") not in (None, "healthy")]
print(",".join(ruins) if ruins else "ok")
PY
)"

if [[ "$status" == "ok" ]]; then
  echo "$agora OK"
else
  echo "$agora FALHA componentes: $status"
  exit 1
fi
