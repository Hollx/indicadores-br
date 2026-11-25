"""Endpoints da API do Observatório. Somente leitura: nada aqui altera o pipeline."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .artefatos import ArtefatoAusente, LeitorArtefatos
from .catalogo import montar_catalogo, montar_linhagem, resumir_cobertura

leitor = LeitorArtefatos(Path(os.environ.get("DBT_ARTEFATOS_DIR", "../../dbt/target")))

app = FastAPI(
    title="Observatório indicadores-br",
    description="Governança, qualidade e monitoramento do pipeline indicadores-br.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGENS", "http://localhost:5173").split(","),
    allow_methods=["GET"],
)


def _catalogo() -> list[dict]:
    try:
        return montar_catalogo(leitor.manifest())
    except ArtefatoAusente as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


@app.get("/saude")
def saude() -> dict:
    """Verifica se a API está de pé e se já existe manifest do dbt para ler."""
    try:
        metadata = leitor.manifest().get("metadata", {})
    except ArtefatoAusente:
        return {"status": "sem_artefatos"}
    return {
        "status": "ok",
        "dbt_versao": metadata.get("dbt_version"),
        "manifest_gerado_em": metadata.get("generated_at"),
    }


@app.get("/catalogo")
def catalogo(camada: str | None = None, tipo: str | None = None) -> list[dict]:
    """Lista os recursos do projeto, com filtro opcional por camada ou tipo."""
    recursos = _catalogo()
    if camada:
        recursos = [r for r in recursos if r["camada"] == camada]
    if tipo:
        recursos = [r for r in recursos if r["tipo"] == tipo]
    return recursos


@app.get("/catalogo/{recurso_id}")
def detalhe(recurso_id: str) -> dict:
    for recurso in _catalogo():
        if recurso["id"] == recurso_id:
            return recurso
    raise HTTPException(status_code=404, detail=f"recurso {recurso_id} não existe")


@app.get("/linhagem")
def linhagem() -> dict:
    return montar_linhagem(_catalogo())


@app.get("/governanca/resumo")
def resumo() -> dict:
    return resumir_cobertura(_catalogo())
