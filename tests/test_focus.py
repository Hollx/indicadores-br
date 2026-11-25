from datetime import UTC, date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

from include import focus


def _registro(data: str, ref: str, mediana: float = 0.4) -> dict:
    return {
        "Indicador": "IPCA",
        "Data": data,
        "DataReferencia": ref,
        "Media": 0.41,
        "Mediana": mediana,
        "DesvioPadrao": 0.1,
        "Minimo": 0.1,
        "Maximo": 0.8,
        "numeroRespondentes": 100,
        "baseCalculo": 0,
    }


class _Resposta:
    def __init__(self, valores):
        self._valores = valores

    def raise_for_status(self):
        pass

    def json(self):
        return {"value": self._valores}


class _SessaoFalsa:
    """Devolve páginas pré-definidas e guarda as URLs pedidas."""

    def __init__(self, paginas):
        self.paginas = list(paginas)
        self.urls = []

    def get(self, url, timeout):
        self.urls.append(url)
        return _Resposta(self.paginas.pop(0))


def test_url_usa_percent_encoding_e_filtra_o_indicador():
    url = focus.montar_url("IGP-M", date(2021, 11, 25), pular=20)
    assert "+" not in url
    query = parse_qs(urlsplit(url).query)
    assert query["$filter"] == [
        "Indicador eq 'IGP-M' and baseCalculo eq 0 and Data ge '2021-11-25'"
    ]
    assert query["$skip"] == ["20"]


def test_url_rejeita_indicador_fora_do_escopo():
    with pytest.raises(ValueError):
        focus.montar_url("Selic", date(2021, 1, 1))


def test_baixar_pagina_ate_a_ultima(monkeypatch):
    monkeypatch.setattr(focus, "TAMANHO_PAGINA", 2)
    sessao = _SessaoFalsa(
        [
            [_registro("2026-11-19", "11/2026"), _registro("2026-11-19", "12/2026")],
            [_registro("2026-11-20", "11/2026")],
        ]
    )
    registros = focus.baixar_expectativas("IPCA", date(2026, 11, 1), session=sessao)
    assert len(registros) == 3
    assert "%24skip=2" in sessao.urls[1]


def test_normalizar_converte_mes_de_referencia():
    ingerido = datetime(2026, 11, 25, 9, 0, tzinfo=UTC)
    linhas = focus.normalizar([_registro("2026-11-19", "3/2027", 0.32)], ingerido_em=ingerido)
    assert linhas == [
        {
            "indicador": "IPCA",
            "data_pesquisa": "2026-11-19",
            "mes_referencia": "2027-03-01",
            "media": 0.41,
            "mediana": 0.32,
            "desvio_padrao": 0.1,
            "minimo": 0.1,
            "maximo": 0.8,
            "respondentes": 100,
            "base_calculo": 0,
            "ingerido_em": "2026-11-25T09:00:00+00:00",
        }
    ]


def test_caminho_bruto_por_indicador():
    caminho = focus.caminho_bruto(Path("/dados"), date(2026, 11, 25), "IGP-M")
    assert caminho == Path("/dados/raw/focus/dt=2026-11-25/igpm.ndjson")
