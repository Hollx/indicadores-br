"""Visualização: leitura da camada Gold no BigQuery, com cache e teto de bytes por consulta."""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

# Teto por consulta: protege a cota gratuita do BigQuery sandbox (1 TB/mês).
MAXIMO_BYTES = 100 * 1024 * 1024
CACHE_SEGUNDOS = 600

INDICADORES_FOCUS = ("IPCA", "IGP-M")


class DadosIndisponiveis(RuntimeError):
    """BigQuery não configurado ou consulta falhou."""


Executor = Callable[[str, dict[str, Any]], list[dict[str, Any]]]


def executor_bigquery(projeto: str) -> Executor:
    """Cria a função que roda SQL parametrizado no BigQuery e devolve linhas como dict."""
    from google.cloud import bigquery

    cliente = bigquery.Client(project=projeto)

    def executar(sql: str, parametros: dict[str, Any]) -> list[dict[str, Any]]:
        config = bigquery.QueryJobConfig(
            maximum_bytes_billed=MAXIMO_BYTES,
            query_parameters=[
                bigquery.ScalarQueryParameter(nome, "STRING", valor)
                for nome, valor in parametros.items()
            ],
        )
        linhas = cliente.query(sql, job_config=config).result()
        return [dict(linha.items()) for linha in linhas]

    return executar


class FonteGold:
    def __init__(self, projeto: str | None, executor: Executor | None = None):
        self.projeto = projeto
        self._executor = executor
        self._cache: dict[tuple, tuple[float, list[dict[str, Any]]]] = {}

    def _consultar(self, sql: str, parametros: dict[str, Any] | None = None) -> list[dict]:
        if not self.projeto:
            raise DadosIndisponiveis("GCP_PROJECT_ID não configurado")
        parametros = parametros or {}
        chave = (sql, tuple(sorted(parametros.items())))
        em_cache = self._cache.get(chave)
        if em_cache and time.monotonic() - em_cache[0] < CACHE_SEGUNDOS:
            return em_cache[1]
        try:
            if self._executor is None:
                self._executor = executor_bigquery(self.projeto)
            linhas = self._executor(sql.format(projeto=self.projeto), parametros)
        except Exception as erro:  # noqa: BLE001 - qualquer falha do cliente vira 503
            raise DadosIndisponiveis(f"consulta ao BigQuery falhou: {erro}") from erro
        self._cache[chave] = (time.monotonic(), linhas)
        return linhas

    def indicadores(self) -> list[dict[str, Any]]:
        return self._consultar(
            """
            select mes, selic_meta_media, dolar_compra_medio, ipca_mensal, igpm_mensal,
                   ipca_acumulado_12m
            from `{projeto}.gold.fct_indicadores_mensais`
            order by mes
            """
        )

    def expectativas(self, indicador: str) -> list[dict[str, Any]]:
        return self._consultar(
            """
            select mes_referencia, horizonte_meses, mediana_esperada, minimo_esperado,
                   maximo_esperado, realizado, erro, dentro_do_intervalo
            from `{projeto}.gold.fct_expectativa_vs_realizado`
            where indicador = @indicador
            order by mes_referencia, horizonte_meses
            """,
            {"indicador": indicador},
        )

    def erro_por_horizonte(self, indicador: str) -> list[dict[str, Any]]:
        return self._consultar(
            """
            select horizonte_meses,
                   count(*) as meses,
                   round(avg(erro), 3) as erro_medio,
                   round(avg(erro_absoluto), 3) as erro_absoluto_medio,
                   round(100 * countif(dentro_do_intervalo) / count(*), 1) as pct_dentro_intervalo
            from `{projeto}.gold.fct_expectativa_vs_realizado`
            where indicador = @indicador and realizado is not null
            group by horizonte_meses
            order by horizonte_meses
            """,
            {"indicador": indicador},
        )
