from datetime import date
from decimal import Decimal

from indicadores_spark.reconciliacao import comparar

JAN = date(2026, 1, 1)
FEV = date(2026, 2, 1)


def _linha(mes, ipca="0.33", acumulado=None):
    return {
        "mes": mes,
        "selic_meta_media": Decimal("15.25"),
        "dolar_compra_medio": Decimal("5.1235"),
        "ipca_mensal": Decimal(ipca),
        "igpm_mensal": None,
        "ipca_acumulado_12m": acumulado,
    }


def test_golds_iguais_reconciliam_mesmo_com_tipos_diferentes():
    spark_rows = [_linha(JAN, acumulado=4.68)]
    dbt_rows = [_linha(JAN, acumulado=Decimal("4.68"))]

    assert comparar(spark_rows, dbt_rows).ok


def test_detecta_valor_divergente():
    resultado = comparar([_linha(JAN, ipca="0.33")], [_linha(JAN, ipca="0.34")])

    assert not resultado.ok
    assert resultado.divergencias == [(JAN, "ipca_mensal", 0.33, 0.34)]


def test_detecta_mes_faltando_dos_dois_lados():
    resultado = comparar([_linha(JAN)], [_linha(FEV)])

    assert resultado.so_no_spark == [JAN]
    assert resultado.so_no_dbt == [FEV]
    assert "DIVERGENTE" in resultado.resumo()


def test_nulo_de_um_lado_so_e_divergencia():
    resultado = comparar([_linha(JAN, acumulado=None)], [_linha(JAN, acumulado=Decimal("4.68"))])

    assert resultado.divergencias == [(JAN, "ipca_acumulado_12m", None, 4.68)]
