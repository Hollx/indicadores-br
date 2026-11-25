"""DAG diária: SGS e Focus (Banco Central) -> data lake bruto -> BigQuery Bronze -> dbt."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import dag, task

from include import bq_loader, focus, sgs

DBT_BIN = "/home/airflow/dbt-venv/bin/dbt"
DBT_CMD = f"cd \"$DBT_PROJECT_DIR\" && {DBT_BIN}"


@dag(
    dag_id="indicadores_br",
    schedule="0 9 * * *",  # 09:00 UTC, depois da atualização diária do SGS
    start_date=datetime(2026, 1, 1, tzinfo=UTC),
    catchup=False,
    max_active_runs=1,
    default_args={"retries": 2, "retry_delay": timedelta(minutes=5)},
    tags=["indicadores-br", "medallion"],
    doc_md=__doc__,
)
def indicadores_br():
    @task
    def extrair(codigo: int) -> str:
        agora = datetime.now(UTC)
        inicio, fim = sgs.janela_historico(agora.date(), int(os.environ["SGS_ANOS_HISTORICO"]))
        registros = sgs.baixar_serie(codigo, inicio, fim)
        linhas = sgs.normalizar(codigo, registros, ingerido_em=agora)
        destino = sgs.caminho_bruto(Path(os.environ["DADOS_DIR"]), agora.date(), codigo)
        sgs.salvar_ndjson(linhas, destino)
        return str(destino)

    @task
    def carregar(arquivos: list[str]) -> int:
        return bq_loader.carregar_bronze(
            list(arquivos),
            projeto=os.environ["GCP_PROJECT_ID"],
            location=os.environ.get("BQ_LOCATION", "US"),
        )

    @task
    def extrair_focus(indicador: str) -> str:
        agora = datetime.now(UTC)
        inicio, _ = sgs.janela_historico(agora.date(), int(os.environ["SGS_ANOS_HISTORICO"]))
        registros = focus.baixar_expectativas(indicador, inicio)
        linhas = focus.normalizar(registros, ingerido_em=agora)
        destino = focus.caminho_bruto(Path(os.environ["DADOS_DIR"]), agora.date(), indicador)
        sgs.salvar_ndjson(linhas, destino)
        return str(destino)

    @task
    def carregar_focus(arquivos: list[str]) -> int:
        return bq_loader.carregar_focus(
            list(arquivos),
            projeto=os.environ["GCP_PROJECT_ID"],
            location=os.environ.get("BQ_LOCATION", "US"),
        )

    freshness = BashOperator(
        task_id="dbt_source_freshness",
        bash_command=f"{DBT_CMD} source freshness",
    )

    dbt_build = BashOperator(
        task_id="dbt_build",
        bash_command=f"{DBT_CMD} build",
    )

    arquivos = extrair.expand(codigo=list(sgs.SERIES_PADRAO))
    arquivos_focus = extrair_focus.expand(indicador=list(focus.INDICADORES))
    [carregar(arquivos), carregar_focus(arquivos_focus)] >> freshness >> dbt_build


indicadores_br()
