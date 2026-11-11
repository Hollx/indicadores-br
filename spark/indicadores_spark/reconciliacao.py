"""Comparação linha a linha entre a Gold do Spark e a Gold do dbt.

A comparação é pura (listas de dicionários), para ser testada no CI sem BigQuery.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

COLUNAS_GOLD = (
    "selic_meta_media",
    "dolar_compra_medio",
    "ipca_mensal",
    "igpm_mensal",
    "ipca_acumulado_12m",
)


@dataclass
class Resultado:
    linhas_spark: int
    linhas_dbt: int
    so_no_spark: list[date] = field(default_factory=list)
    so_no_dbt: list[date] = field(default_factory=list)
    divergencias: list[tuple[date, str, Any, Any]] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not (self.so_no_spark or self.so_no_dbt or self.divergencias)

    def resumo(self) -> str:
        linhas = [
            f"linhas: spark={self.linhas_spark} dbt={self.linhas_dbt}",
            f"meses só no spark: {len(self.so_no_spark)}",
            f"meses só no dbt: {len(self.so_no_dbt)}",
            f"valores divergentes: {len(self.divergencias)}",
        ]
        for mes, coluna, v_spark, v_dbt in self.divergencias[:20]:
            linhas.append(f"  {mes} {coluna}: spark={v_spark} dbt={v_dbt}")
        linhas.append("RECONCILIADO" if self.ok else "DIVERGENTE")
        return "\n".join(linhas)


def _numero(valor: Any) -> float | None:
    if valor is None:
        return None
    if isinstance(valor, Decimal):
        return float(valor)
    return float(valor)


def comparar(
    spark_rows: list[dict[str, Any]],
    dbt_rows: list[dict[str, Any]],
    tolerancia: float = 1e-6,
) -> Resultado:
    """Compara as duas Golds pela chave `mes`, coluna a coluna, com tolerância numérica."""
    spark_por_mes = {r["mes"]: r for r in spark_rows}
    dbt_por_mes = {r["mes"]: r for r in dbt_rows}

    resultado = Resultado(linhas_spark=len(spark_rows), linhas_dbt=len(dbt_rows))
    resultado.so_no_spark = sorted(spark_por_mes.keys() - dbt_por_mes.keys())
    resultado.so_no_dbt = sorted(dbt_por_mes.keys() - spark_por_mes.keys())

    for mes in sorted(spark_por_mes.keys() & dbt_por_mes.keys()):
        for coluna in COLUNAS_GOLD:
            v_spark = _numero(spark_por_mes[mes].get(coluna))
            v_dbt = _numero(dbt_por_mes[mes].get(coluna))
            if v_spark is None and v_dbt is None:
                continue
            if v_spark is None or v_dbt is None or abs(v_spark - v_dbt) > tolerancia:
                resultado.divergencias.append((mes, coluna, v_spark, v_dbt))

    return resultado
