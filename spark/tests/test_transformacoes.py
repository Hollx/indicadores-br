from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from indicadores_spark import transformacoes as tr

SEED = Path(__file__).resolve().parents[2] / "dbt" / "seeds" / "series_sgs.csv"


def _bronze(spark, linhas):
    return spark.createDataFrame(linhas, tr.SCHEMA_BRONZE)


@pytest.fixture
def series(spark):
    return tr.ler_series(spark, SEED)


def test_silver_converte_virgula_e_anula_texto_invalido(spark, series):
    bronze = _bronze(
        spark,
        [
            (432, "2026-01-02", "15,25", "2026-01-03T06:00:00+00:00"),
            (432, "2026-01-05", "n/d", "2026-01-06T06:00:00+00:00"),
        ],
    )
    linhas = {r.data_referencia: r for r in tr.silver(bronze, series).collect()}

    assert linhas[date(2026, 1, 2)].valor == Decimal("15.25")
    assert linhas[date(2026, 1, 5)].valor is None
    assert linhas[date(2026, 1, 2)].nome_serie == "selic_meta"


def test_silver_mantem_a_ingestao_mais_recente(spark, series):
    bronze = _bronze(
        spark,
        [
            (1, "2026-01-02", "5.10", "2026-01-02T06:00:00+00:00"),
            (1, "2026-01-02", "5.20", "2026-01-03T06:00:00+00:00"),
        ],
    )
    linhas = tr.silver(bronze, series).collect()

    assert len(linhas) == 1
    assert linhas[0].valor == Decimal("5.20")


def test_gold_media_mensal_e_pivot(spark, series):
    bronze = _bronze(
        spark,
        [
            (432, "2026-01-02", "15.00", "2026-02-01T00:00:00+00:00"),
            (432, "2026-01-20", "15.50", "2026-02-01T00:00:00+00:00"),
            (1, "2026-01-02", "5.12345", "2026-02-01T00:00:00+00:00"),
            (433, "2026-01-01", "0.33", "2026-02-01T00:00:00+00:00"),
        ],
    )
    (linha,) = tr.gold(tr.silver(bronze, series)).collect()

    assert linha.mes == date(2026, 1, 1)
    assert float(linha.selic_meta_media) == 15.25
    assert float(linha.dolar_compra_medio) == 5.1235  # arredondado em 4 casas
    assert float(linha.ipca_mensal) == 0.33
    assert linha.igpm_mensal is None


def test_gold_ipca_acumulado_so_com_12_meses_completos(spark, series):
    # 13 meses de IPCA a 1% a.m.: acumulado de 12 meses = (1,01^12 - 1) * 100 = 12,68%
    linhas_bronze = [
        (433, f"{2025 + (m // 12)}-{m % 12 + 1:02d}-01", "1.00", "2026-02-01T00:00:00+00:00")
        for m in range(13)
    ]
    gold = tr.gold(tr.silver(_bronze(spark, linhas_bronze), series)).collect()

    assert len(gold) == 13
    assert all(r.ipca_acumulado_12m is None for r in gold[:11])
    assert gold[11].ipca_acumulado_12m == pytest.approx(12.68)
    assert gold[12].ipca_acumulado_12m == pytest.approx(12.68)


def test_particoes_brutas_ordena_e_ignora_lixo(tmp_path):
    for nome in ("dt=2026-11-02", "dt=2026-10-30", "tmp", "dt=errado"):
        (tmp_path / nome).mkdir()

    assert [p.name for p in tr.particoes_brutas(tmp_path)] == ["dt=2026-10-30", "dt=2026-11-02"]
