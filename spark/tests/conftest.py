import pytest
from pyspark.sql import SparkSession


@pytest.fixture(scope="session")
def spark():
    sessao = (
        SparkSession.builder.master("local[1]")
        .appName("testes-indicadores-br")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", "1")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )
    yield sessao
    sessao.stop()
