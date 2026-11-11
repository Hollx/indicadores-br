"""Baixa a Bronze do SGS para data/raw/ na máquina local, no mesmo layout do Airflow.

Serve para desenvolver o módulo Spark sem a VPS. Para reconciliar com o dbt, prefira
copiar o data/raw/ da VPS (`make spark-raw-sync`): a reconciliação só fecha quando o
Spark lê exatamente a mesma janela que o Airflow carregou no BigQuery.

Uso: python spark/baixar_raw_local.py [--anos 10]
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, date, datetime
from pathlib import Path

RAIZ_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_REPO / "airflow"))

from include import sgs  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--anos", type=int, default=10)
    parser.add_argument("--base", default=str(RAIZ_REPO / "data"))
    args = parser.parse_args()

    hoje = date.today()
    inicio, fim = sgs.janela_historico(hoje, args.anos)
    agora = datetime.now(UTC)
    for codigo, nome in sgs.SERIES_PADRAO.items():
        registros = sgs.baixar_serie(codigo, inicio, fim)
        linhas = sgs.normalizar(codigo, registros, agora)
        destino = sgs.salvar_ndjson(linhas, sgs.caminho_bruto(Path(args.base), hoje, codigo))
        print(f"{nome}: {len(linhas)} linhas -> {destino}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
