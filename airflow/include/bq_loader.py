"""Carga da Bronze no BigQuery.

Usa load job com WRITE_TRUNCATE: load jobs são gratuitos e funcionam no BigQuery sandbox,
que não aceita DML (INSERT/MERGE).
"""

from __future__ import annotations

import tempfile
from pathlib import Path

TABELA_BRONZE = "bronze.sgs_observacoes"


def _schema():
    from google.cloud import bigquery

    return [
        bigquery.SchemaField("serie_id", "INTEGER", mode="REQUIRED"),
        bigquery.SchemaField("data_referencia", "DATE", mode="REQUIRED"),
        bigquery.SchemaField("valor_texto", "STRING"),
        bigquery.SchemaField("ingerido_em", "TIMESTAMP", mode="REQUIRED"),
    ]


def concatenar(arquivos: list[Path], destino: Path) -> int:
    """Junta vários NDJSON num só e retorna o número de linhas."""
    total = 0
    with destino.open("w", encoding="utf-8") as saida:
        for arquivo in arquivos:
            with Path(arquivo).open(encoding="utf-8") as entrada:
                for linha in entrada:
                    if linha.strip():
                        saida.write(linha if linha.endswith("\n") else linha + "\n")
                        total += 1
    return total


def carregar_bronze(arquivos: list[str], projeto: str, location: str) -> int:
    """Substitui a tabela Bronze pelo conteúdo dos arquivos. Retorna as linhas carregadas."""
    from google.cloud import bigquery

    if not arquivos:
        raise ValueError("nenhum arquivo para carregar")

    client = bigquery.Client(project=projeto, location=location)
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        schema=_schema(),
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )

    with tempfile.TemporaryDirectory() as tmp:
        combinado = Path(tmp) / "bronze.ndjson"
        linhas = concatenar([Path(a) for a in arquivos], combinado)
        if linhas == 0:
            raise ValueError("arquivos vazios: nada a carregar")
        with combinado.open("rb") as fonte:
            job = client.load_table_from_file(
                fonte, f"{projeto}.{TABELA_BRONZE}", job_config=job_config
            )
        job.result()

    return linhas
