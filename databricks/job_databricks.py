"""Job do Databricks (Free Edition, serverless): Bronze no Volume -> Silver e Gold em Delta.

Usa as mesmas funções de `indicadores_spark.transformacoes` do job local; só a leitura
(Volume do Unity Catalog) e a escrita (tabelas Delta gerenciadas) mudam.

A Free Edition não tem saída de rede para a API do BC nem para o BigQuery, então o NDJSON
chega por upload (`scripts/enviar-raw-databricks.sh`) e o job nunca chama serviços externos.

Parâmetros: --catalog workspace --schema indicadores [--todas-particoes]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# O bundle sincroniza spark/ e dbt/seeds/ ao lado desta pasta no workspace.
try:
    _AQUI = Path(__file__).resolve().parent
except NameError:  # alguns runtimes executam o arquivo sem __file__
    _AQUI = Path.cwd()
RAIZ = _AQUI.parent
sys.path.insert(0, str(RAIZ / "spark"))

from pyspark.sql import SparkSession  # noqa: E402

from indicadores_spark import transformacoes  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="workspace")
    parser.add_argument("--schema", default="indicadores")
    parser.add_argument("--todas-particoes", action="store_true")
    args = parser.parse_args(argv)

    spark = SparkSession.builder.getOrCreate()
    alvo = f"{args.catalog}.{args.schema}"
    spark.sql(f"create schema if not exists {alvo}")
    spark.sql(f"create volume if not exists {alvo}.raw")

    raiz_volume = Path(f"/Volumes/{args.catalog}/{args.schema}/raw/sgs")
    particoes = transformacoes.particoes_brutas(raiz_volume)
    if not particoes:
        print(f"nenhuma partição em {raiz_volume}; rode scripts/enviar-raw-databricks.sh")
        return 1
    lidas = particoes if args.todas_particoes else particoes[-1:]
    print(f"lendo {len(lidas)} partição(ões): {lidas[0].name} .. {lidas[-1].name}")

    bronze = transformacoes.ler_bronze(spark, [str(p) for p in lidas])
    series = transformacoes.ler_series(spark, RAIZ / "dbt" / "seeds" / "series_sgs.csv")
    silver = transformacoes.silver(bronze, series)
    gold = transformacoes.gold(silver)

    for tabela, df in (("silver_sgs_observacoes", silver), ("gold_indicadores_mensais", gold)):
        (
            df.write.format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(f"{alvo}.{tabela}")
        )
        print(f"{alvo}.{tabela}: {spark.table(f'{alvo}.{tabela}').count()} linhas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
