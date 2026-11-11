"""Job PySpark local: Bronze (NDJSON) -> Silver e Gold em Parquet, e reconciliação com o dbt.

Uso (a partir da raiz do repositório):
    python -m indicadores_spark.job_local executar [--todas-particoes]
    python -m indicadores_spark.job_local reconciliar

Por padrão lê só a partição `dt=` mais recente, porque cada execução do Airflow substitui
a Bronze do BigQuery pela janela baixada naquele dia. É o mesmo recorte que o dbt enxerga.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from pyspark.sql import SparkSession

from indicadores_spark import reconciliacao, transformacoes

RAIZ_REPO = Path(__file__).resolve().parents[2]


def criar_sessao(nome: str = "indicadores-br") -> SparkSession:
    return (
        SparkSession.builder.appName(nome)
        .master(os.environ.get("SPARK_MASTER", "local[*]"))
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.ui.showConsoleProgress", "false")
        .getOrCreate()
    )


def executar(args: argparse.Namespace) -> int:
    raiz_bruta = Path(args.raw)
    particoes = transformacoes.particoes_brutas(raiz_bruta)
    if not particoes:
        print(f"nenhuma partição dt=AAAA-MM-DD em {raiz_bruta}", file=sys.stderr)
        return 1
    lidas = particoes if args.todas_particoes else particoes[-1:]
    print(f"lendo {len(lidas)} partição(ões): {lidas[0].name} .. {lidas[-1].name}")

    spark = criar_sessao()
    bronze = transformacoes.ler_bronze(spark, [str(p) for p in lidas])
    series = transformacoes.ler_series(spark, args.seed)

    silver = transformacoes.silver(bronze, series).cache()
    gold = transformacoes.gold(silver)

    saida = Path(args.saida)
    silver.write.mode("overwrite").parquet(str(saida / "silver" / "sgs_observacoes"))
    gold.write.mode("overwrite").parquet(str(saida / "gold" / "fct_indicadores_mensais"))

    print(f"silver: {silver.count()} linhas | gold: {gold.count()} meses -> {saida}")
    spark.stop()
    return 0


def reconciliar(args: argparse.Namespace) -> int:
    # Import tardio: só a reconciliação precisa do cliente do BigQuery.
    from google.cloud import bigquery

    projeto = args.projeto or os.environ.get("GCP_PROJECT_ID")
    if not projeto:
        print("defina --projeto ou GCP_PROJECT_ID", file=sys.stderr)
        return 2

    spark = criar_sessao("indicadores-br-reconciliacao")
    caminho_gold = Path(args.saida) / "gold" / "fct_indicadores_mensais"
    spark_rows = [r.asDict() for r in spark.read.parquet(str(caminho_gold)).collect()]
    spark.stop()

    cliente = bigquery.Client(project=projeto, location=args.location)
    consulta = f"select * from `{projeto}.gold.fct_indicadores_mensais`"
    dbt_rows = [dict(r.items()) for r in cliente.query(consulta).result()]

    resultado = reconciliacao.comparar(spark_rows, dbt_rows, tolerancia=args.tolerancia)
    print(resultado.resumo())
    return 0 if resultado.ok else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--raw", default=str(RAIZ_REPO / "data" / "raw" / "sgs"))
    parser.add_argument("--seed", default=str(RAIZ_REPO / "dbt" / "seeds" / "series_sgs.csv"))
    parser.add_argument("--saida", default=str(RAIZ_REPO / "data" / "lakehouse"))
    sub = parser.add_subparsers(dest="comando", required=True)

    p_exec = sub.add_parser("executar", help="Bronze -> Silver -> Gold em Parquet")
    p_exec.add_argument(
        "--todas-particoes",
        action="store_true",
        help="lê todo o histórico de dt=, não só a partição mais recente",
    )
    p_exec.set_defaults(func=executar)

    p_rec = sub.add_parser("reconciliar", help="compara a Gold do Spark com a Gold do dbt")
    p_rec.add_argument("--projeto", default=None)
    p_rec.add_argument("--location", default=os.environ.get("BQ_LOCATION", "US"))
    p_rec.add_argument("--tolerancia", type=float, default=1e-6)
    p_rec.set_defaults(func=reconciliar)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
