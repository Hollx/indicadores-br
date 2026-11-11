"""Transformações Bronze -> Silver -> Gold em PySpark.

Espelham os modelos dbt `stg_sgs__observacoes` (Silver) e `fct_indicadores_mensais` (Gold),
para que as duas implementações possam ser reconciliadas linha a linha.

Funções puras sobre DataFrames: não leem nem escrevem nada, então rodam iguais no
PySpark local, no CI e no Databricks.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

from pyspark.sql import Column, DataFrame, SparkSession, Window
from pyspark.sql import functions as F
from pyspark.sql import types as T

# Schema explícito da Bronze: o mesmo que `include.sgs.normalizar` grava no NDJSON.
# Ler com schema fixo evita inferência (lenta e instável) e falha cedo se o formato mudar.
SCHEMA_BRONZE = T.StructType(
    [
        T.StructField("serie_id", T.LongType()),
        T.StructField("data_referencia", T.StringType()),
        T.StructField("valor_texto", T.StringType()),
        T.StructField("ingerido_em", T.StringType()),
    ]
)

SCHEMA_SERIES = T.StructType(
    [
        T.StructField("serie_id", T.LongType()),
        T.StructField("nome_serie", T.StringType()),
        T.StructField("descricao", T.StringType()),
        T.StructField("unidade", T.StringType()),
        T.StructField("periodicidade", T.StringType()),
    ]
)

# NUMERIC do BigQuery: precisão 38, escala 9.
TIPO_VALOR = T.DecimalType(38, 9)

_PARTICAO = re.compile(r"^dt=(\d{4}-\d{2}-\d{2})$")


def particoes_brutas(raiz: Path) -> list[Path]:
    """Partições `dt=AAAA-MM-DD` do data lake bruto, da mais antiga para a mais recente."""
    return sorted(p for p in raiz.iterdir() if p.is_dir() and _PARTICAO.match(p.name))


def ler_bronze(spark: SparkSession, caminho: str | list[str]) -> DataFrame:
    """Lê NDJSON da Bronze com schema explícito (uma ou mais pastas, ou um glob)."""
    return spark.read.schema(SCHEMA_BRONZE).option("mode", "FAILFAST").json(caminho)


def ler_series(spark: SparkSession, caminho_csv: str | Path) -> DataFrame:
    """Catálogo de séries (o seed do dbt).

    Lido com o módulo csv e não com spark.read, porque no Databricks serverless o
    arquivo vem do workspace, onde o Spark não lê caminhos locais.
    """
    with open(caminho_csv, encoding="utf-8", newline="") as arquivo:
        linhas = [
            (int(r["serie_id"]), r["nome_serie"], r["descricao"], r["unidade"], r["periodicidade"])
            for r in csv.DictReader(arquivo)
        ]
    return spark.createDataFrame(linhas, SCHEMA_SERIES)


def silver(bronze: DataFrame, series: DataFrame) -> DataFrame:
    """Tipagem, deduplicação e enriquecimento (espelha `stg_sgs__observacoes`).

    - valor: troca vírgula por ponto e converte com try_cast (o `safe_cast` do BigQuery):
      texto inválido vira nulo em vez de derrubar o job.
    - deduplicação: mantém a observação mais recente por série e data
      (o `qualify row_number()` do dbt).
    """
    tipado = bronze.select(
        F.col("serie_id"),
        F.to_date("data_referencia").alias("data_referencia"),
        F.regexp_replace(F.trim("valor_texto"), ",", ".").try_cast(TIPO_VALOR).alias("valor"),
        F.col("ingerido_em").try_cast(T.TimestampType()).alias("ingerido_em"),
    )

    mais_recente = Window.partitionBy("serie_id", "data_referencia").orderBy(
        F.col("ingerido_em").desc()
    )
    deduplicado = (
        tipado.withColumn("_ordem", F.row_number().over(mais_recente))
        .filter(F.col("_ordem") == 1)
        .drop("_ordem")
    )

    return deduplicado.join(
        series.select("serie_id", "nome_serie", "unidade", "periodicidade"),
        on="serie_id",
        how="left",
    ).select(
        "serie_id",
        "nome_serie",
        "unidade",
        "periodicidade",
        "data_referencia",
        "valor",
        "ingerido_em",
    )


def _da_serie(nome: str) -> Column:
    return F.when(F.col("nome_serie") == nome, F.col("valor"))


def gold(silver_df: DataFrame) -> DataFrame:
    """Uma linha por mês com os indicadores lado a lado (espelha `fct_indicadores_mensais`).

    O IPCA acumulado em 12 meses é o produto dos fatores mensais, calculado como
    exp(soma(ln(1 + ipca/100))) numa janela de 12 linhas. Só é preenchido quando a
    janela tem os 12 meses completos.
    """
    mensal = (
        silver_df.withColumn("mes", F.trunc("data_referencia", "month"))
        .groupBy("mes")
        .agg(
            F.avg(_da_serie("selic_meta")).alias("selic_meta_media"),
            F.avg(_da_serie("dolar_compra")).alias("dolar_compra_medio"),
            F.max(_da_serie("ipca_mensal")).alias("ipca_mensal"),
            F.max(_da_serie("igpm_mensal")).alias("igpm_mensal"),
        )
    )

    # Série única e pequena (algumas centenas de meses): a janela sem partição é intencional.
    janela_12m = Window.orderBy("mes").rowsBetween(-11, Window.currentRow)
    ipca_double = F.col("ipca_mensal").cast(T.DoubleType())

    acumulado = mensal.withColumn(
        "meses_ipca_na_janela", F.count("ipca_mensal").over(janela_12m)
    ).withColumn("fator_ipca_12m", F.exp(F.sum(F.log(1 + ipca_double / 100)).over(janela_12m)))

    return acumulado.select(
        "mes",
        F.round("selic_meta_media", 2).alias("selic_meta_media"),
        F.round("dolar_compra_medio", 4).alias("dolar_compra_medio"),
        "ipca_mensal",
        "igpm_mensal",
        F.when(
            F.col("meses_ipca_na_janela") == 12,
            F.round((F.col("fator_ipca_12m") - 1) * 100, 2),
        ).alias("ipca_acumulado_12m"),
    ).orderBy("mes")
