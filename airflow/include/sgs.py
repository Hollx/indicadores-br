"""Extração de séries do SGS (Sistema Gerenciador de Séries Temporais) do Banco Central.

Funções puras e sem dependência do Airflow, para poderem ser testadas com pytest.
Documentação da API: https://dadosabertos.bcb.gov.br/
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

import requests

BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"

# código SGS -> nome usado no warehouse (o seed dbt/seeds/series_sgs.csv descreve cada um)
SERIES_PADRAO: dict[int, str] = {
    432: "selic_meta",
    433: "ipca_mensal",
    1: "dolar_compra",
    189: "igpm_mensal",
}

# Séries diárias do SGS aceitam no máximo 10 anos por consulta.
MAX_ANOS_POR_CONSULTA = 10


def janela_historico(hoje: date, anos: int) -> tuple[date, date]:
    """Janela [inicio, hoje] com `anos` de histórico, limitada ao máximo da API."""
    if anos < 1:
        raise ValueError("anos deve ser >= 1")
    anos = min(anos, MAX_ANOS_POR_CONSULTA)
    try:
        inicio = hoje.replace(year=hoje.year - anos)
    except ValueError:  # 29/02 em ano não bissexto
        inicio = hoje.replace(year=hoje.year - anos, day=28)
    return inicio, hoje


def montar_parametros(data_inicial: date, data_final: date) -> dict[str, str]:
    if data_inicial > data_final:
        raise ValueError("data_inicial posterior a data_final")
    return {
        "formato": "json",
        "dataInicial": data_inicial.strftime("%d/%m/%Y"),
        "dataFinal": data_final.strftime("%d/%m/%Y"),
    }


def baixar_serie(
    codigo: int,
    data_inicial: date,
    data_final: date,
    session: requests.Session | None = None,
    timeout: int = 30,
) -> list[dict[str, Any]]:
    """Baixa uma série do SGS. Retorna a lista crua [{"data": "dd/mm/aaaa", "valor": "x"}]."""
    http = session or requests.Session()
    resposta = http.get(
        BASE_URL.format(codigo=codigo),
        params=montar_parametros(data_inicial, data_final),
        timeout=timeout,
    )
    resposta.raise_for_status()
    dados = resposta.json()
    if not isinstance(dados, list):
        raise ValueError(f"resposta inesperada do SGS para a série {codigo}: {dados!r}")
    return dados


def normalizar(
    codigo: int, registros: list[dict[str, Any]], ingerido_em: datetime
) -> list[dict[str, Any]]:
    """Converte o formato do SGS no schema da Bronze.

    O valor fica como texto na Bronze; a tipagem numérica acontece na Silver (dbt).
    """
    linhas = []
    for registro in registros:
        data_ref = datetime.strptime(registro["data"], "%d/%m/%Y").date()
        linhas.append(
            {
                "serie_id": codigo,
                "data_referencia": data_ref.isoformat(),
                "valor_texto": str(registro["valor"]),
                "ingerido_em": ingerido_em.isoformat(),
            }
        )
    return linhas


def salvar_ndjson(linhas: list[dict[str, Any]], caminho: Path) -> Path:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.open("w", encoding="utf-8") as arquivo:
        for linha in linhas:
            arquivo.write(json.dumps(linha, ensure_ascii=False) + "\n")
    return caminho


def caminho_bruto(base: Path, dia: date, codigo: int) -> Path:
    """Layout do data lake bruto: raw/sgs/dt=AAAA-MM-DD/serie_<codigo>.ndjson"""
    return base / "raw" / "sgs" / f"dt={dia.isoformat()}" / f"serie_{codigo}.ndjson"
