"""Leitura dos artefatos do dbt (manifest.json, run_results.json, sources.json).

O dbt reescreve esses arquivos a cada execução. A leitura é refeita só quando o arquivo
muda (mtime), então a API sempre mostra a última execução sem reler o disco a cada request.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ArtefatoAusente(FileNotFoundError):
    """O dbt ainda não gerou o artefato pedido (nenhum parse/build rodou)."""


@dataclass
class LeitorArtefatos:
    pasta: Path
    _cache: dict[str, tuple[float, dict[str, Any]]] = field(default_factory=dict)

    def ler(self, nome: str) -> dict[str, Any]:
        caminho = self.pasta / nome
        try:
            mtime = caminho.stat().st_mtime
        except FileNotFoundError as erro:
            raise ArtefatoAusente(f"{nome} não encontrado em {self.pasta}") from erro
        em_cache = self._cache.get(nome)
        if em_cache and em_cache[0] == mtime:
            return em_cache[1]
        dados = json.loads(caminho.read_text(encoding="utf-8"))
        self._cache[nome] = (mtime, dados)
        return dados

    def manifest(self) -> dict[str, Any]:
        return self.ler("manifest.json")
