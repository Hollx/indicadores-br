"""Job do Databricks (Free Edition, serverless): Bronze no Volume -> Silver e Gold em Delta.

Roda como `python_wheel_task` (entry point `indicadores-databricks` do wheel), então nem o
código nem os dados vêm de arquivos do workspace: o runtime serverless da Free Edition
falhou com erro de I/O ao ler arquivos do workspace. Usa as mesmas funções de
`indicadores_spark.transformacoes` do job local; só a leitura (Volume do Unity Catalog)
e a escrita (tabelas Delta gerenciadas) mudam.

A Free Edition não tem saída de rede para a API do BC nem para o BigQuery, então a Bronze
e o catálogo de séries chegam por upload (`scripts/enviar-raw-databricks.sh`) e o job
nunca chama serviços externos.

Parâmetros: --catalog workspace --schema indicadores [--todas-particoes]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from pyspark.sql import SparkSession

from indicadores_spark import transformacoes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="workspace")
    parser.add_argument("--schema", default="indicadores")
    parser.add_argument("--todas-particoes", action="store_true")
    args = parser.parse_args(argv)

    spark = SparkSession.builder.getOrCreate()
    alvo = f"{args.catalog}.{args.schema}"

    raiz_volume = Path(f"/Volumes/{args.catalog}/{args.schema}/raw")
    particoes = transformacoes.particoes_brutas(raiz_volume / "sgs")
    if not particoes:
        # Exceção, não código de saída: a python_wheel_task ignora o retorno do entry point.
        raise SystemExit(
            f"nenhuma partição em {raiz_volume / 'sgs'}; rode scripts/enviar-raw-databricks.sh"
        )
    lidas = particoes if args.todas_particoes else particoes[-1:]
    print(f"lendo {len(lidas)} partição(ões): {lidas[0].name} .. {lidas[-1].name}")

    bronze = transformacoes.ler_bronze(spark, [str(p) for p in lidas])
    series = transformacoes.ler_series(spark, raiz_volume / "series_sgs.csv")
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
