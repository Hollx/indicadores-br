"""Extração das expectativas de mercado (Boletim Focus) da API Olinda do Banco Central.

O Focus reúne as projeções de instituições financeiras para inflação, juros e câmbio.
Aqui entram as expectativas MENSAIS de IPCA e IGP-M, que podem ser comparadas com os
valores realizados que o SGS já traz.

Funções puras e sem dependência do Airflow, para poderem ser testadas com pytest.
Documentação: https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado
"""

from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import requests

BASE_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
    "ExpectativaMercadoMensais"
)

# Indicador no Focus -> nome da série realizada no warehouse (seed series_sgs).
INDICADORES: dict[str, str] = {
    "IPCA": "ipca_mensal",
    "IGP-M": "igpm_mensal",
}

TAMANHO_PAGINA = 10_000

# baseCalculo 0 = estatística sobre todos os respondentes dos últimos 30 dias (a série
# publicada no boletim). baseCalculo 1 = só quem atualizou nos últimos 5 dias úteis.
BASE_CALCULO_PADRAO = 0


def montar_url(indicador: str, data_inicial: date, pular: int = 0) -> str:
    """URL OData de uma página. A API Olinda exige espaço como %20 (não aceita '+')."""
    if indicador not in INDICADORES:
        raise ValueError(f"indicador fora do escopo: {indicador!r}")
    filtro = (
        f"Indicador eq '{indicador}' and baseCalculo eq {BASE_CALCULO_PADRAO} "
        f"and Data ge '{data_inicial.isoformat()}'"
    )
    parametros = {
        "$filter": filtro,
        "$orderby": "Data asc",
        "$top": TAMANHO_PAGINA,
        "$skip": pular,
        "$format": "json",
    }
    return f"{BASE_URL}?{urlencode(parametros, quote_via=quote)}"


def baixar_expectativas(
    indicador: str,
    data_inicial: date,
    session: requests.Session | None = None,
    timeout: int = 60,
) -> list[dict[str, Any]]:
    """Baixa todas as páginas de um indicador a partir de `data_inicial`."""
    http = session or requests.Session()
    registros: list[dict[str, Any]] = []
    while True:
        resposta = http.get(montar_url(indicador, data_inicial, len(registros)), timeout=timeout)
        resposta.raise_for_status()
        pagina = resposta.json().get("value")
        if not isinstance(pagina, list):
            raise ValueError(f"resposta inesperada do Focus para {indicador}")
        registros.extend(pagina)
        if len(pagina) < TAMANHO_PAGINA:
            return registros


def _mes_referencia(texto: str) -> str:
    """'11/2026' -> '2026-11-01' (primeiro dia do mês, como a Gold do SGS)."""
    mes, ano = texto.split("/")
    return date(int(ano), int(mes), 1).isoformat()


def normalizar(registros: list[dict[str, Any]], ingerido_em: datetime) -> list[dict[str, Any]]:
    """Converte o formato do Focus no schema da Bronze (uma linha por pesquisa e mês-alvo)."""
    return [
        {
            "indicador": r["Indicador"],
            "data_pesquisa": r["Data"],
            "mes_referencia": _mes_referencia(r["DataReferencia"]),
            "media": r.get("Media"),
            "mediana": r.get("Mediana"),
            "desvio_padrao": r.get("DesvioPadrao"),
            "minimo": r.get("Minimo"),
            "maximo": r.get("Maximo"),
            "respondentes": r.get("numeroRespondentes"),
            "base_calculo": r.get("baseCalculo"),
            "ingerido_em": ingerido_em.isoformat(),
        }
        for r in registros
    ]


def caminho_bruto(base: Path, dia: date, indicador: str) -> Path:
    """Layout do data lake bruto: raw/focus/dt=AAAA-MM-DD/<indicador>.ndjson"""
    nome = indicador.lower().replace("-", "")
    return base / "raw" / "focus" / f"dt={dia.isoformat()}" / f"{nome}.ndjson"
