"""Endpoints da API do Farol. Somente leitura: nada aqui altera o pipeline."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .artefatos import ArtefatoAusente, LeitorArtefatos
from .catalogo import montar_catalogo, montar_linhagem, resumir_cobertura
from .dados import INDICADORES_FOCUS, DadosIndisponiveis, FonteGold
from .etapas import montar_etapas
from .historico import Historico
from .monitoramento import AirflowIndisponivel, ClienteAirflow
from .qualidade import horas_desde, resumir_execucao, resumir_frescor

app = FastAPI(
    title="Farol indicadores-br",
    description="Monitoramento, governança, qualidade e visualização do pipeline indicadores-br.",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGENS", "http://localhost:5173").split(","),
    allow_methods=["GET"],
)


# --- dependências (trocadas nos testes via app.dependency_overrides) -------------------------


@lru_cache
def obter_leitor() -> LeitorArtefatos:
    return LeitorArtefatos(Path(os.environ.get("DBT_ARTEFATOS_DIR", "../../dbt/target")))


@lru_cache
def obter_historico() -> Historico:
    return Historico(os.environ.get("FAROL_DB", "farol.db"))


@lru_cache
def obter_airflow() -> ClienteAirflow:
    return ClienteAirflow(
        os.environ.get("AIRFLOW_URL"),
        os.environ.get("AIRFLOW_USUARIO"),
        os.environ.get("AIRFLOW_SENHA"),
    )


@lru_cache
def obter_gold() -> FonteGold:
    return FonteGold(os.environ.get("GCP_PROJECT_ID"))


def _manifest(leitor: LeitorArtefatos) -> dict[str, Any]:
    try:
        return leitor.manifest()
    except ArtefatoAusente as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


def _opcional(leitor: LeitorArtefatos, nome: str) -> dict[str, Any] | None:
    try:
        return leitor.ler(nome)
    except ArtefatoAusente:
        return None


def _ultima_execucao(leitor: LeitorArtefatos, historico: Historico) -> dict[str, Any] | None:
    """Resumo da última execução do dbt; registra no histórico na primeira leitura."""
    run_results = _opcional(leitor, "run_results.json")
    if run_results is None:
        return None
    execucao = resumir_execucao(run_results, _manifest(leitor))
    historico.registrar(execucao)
    return execucao


# --- saúde e governança ----------------------------------------------------------------------


@app.get("/saude")
def saude(leitor: LeitorArtefatos = Depends(obter_leitor)) -> dict:
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
def catalogo(
    camada: str | None = None,
    tipo: str | None = None,
    leitor: LeitorArtefatos = Depends(obter_leitor),
) -> list[dict]:
    """Lista os recursos do projeto, com filtro opcional por camada ou tipo."""
    recursos = montar_catalogo(_manifest(leitor))
    if camada:
        recursos = [r for r in recursos if r["camada"] == camada]
    if tipo:
        recursos = [r for r in recursos if r["tipo"] == tipo]
    return recursos


@app.get("/catalogo/{recurso_id}")
def detalhe(recurso_id: str, leitor: LeitorArtefatos = Depends(obter_leitor)) -> dict:
    for recurso in montar_catalogo(_manifest(leitor)):
        if recurso["id"] == recurso_id:
            return recurso
    raise HTTPException(status_code=404, detail=f"recurso {recurso_id} não existe")


@app.get("/linhagem")
def linhagem(leitor: LeitorArtefatos = Depends(obter_leitor)) -> dict:
    return montar_linhagem(montar_catalogo(_manifest(leitor)))


@app.get("/governanca/resumo")
def resumo(leitor: LeitorArtefatos = Depends(obter_leitor)) -> dict:
    return resumir_cobertura(montar_catalogo(_manifest(leitor)))


# --- qualidade -------------------------------------------------------------------------------


@app.get("/qualidade/execucao")
def qualidade_execucao(
    leitor: LeitorArtefatos = Depends(obter_leitor),
    historico: Historico = Depends(obter_historico),
) -> dict:
    """Última execução do dbt: cada modelo e teste, com status e tempo."""
    execucao = _ultima_execucao(leitor, historico)
    if execucao is None:
        raise HTTPException(status_code=503, detail="run_results.json ainda não existe")
    execucao["horas_desde"] = horas_desde(execucao["gerado_em"], datetime.now(UTC))
    return execucao


@app.get("/qualidade/frescor")
def qualidade_frescor(leitor: LeitorArtefatos = Depends(obter_leitor)) -> dict:
    sources = _opcional(leitor, "sources.json")
    if sources is None:
        raise HTTPException(status_code=503, detail="sources.json ainda não existe")
    return resumir_frescor(sources, _manifest(leitor), datetime.now(UTC))


@app.get("/qualidade/historico")
def qualidade_historico(
    limite: int = Query(30, ge=1, le=200),
    leitor: LeitorArtefatos = Depends(obter_leitor),
    historico: Historico = Depends(obter_historico),
) -> list[dict]:
    """Execuções do dbt já vistas pelo Farol, da mais recente para a mais antiga."""
    _ultima_execucao(leitor, historico)
    return historico.execucoes(limite)


@app.get("/qualidade/historico/{no_id}")
def qualidade_historico_no(
    no_id: str,
    limite: int = Query(30, ge=1, le=200),
    historico: Historico = Depends(obter_historico),
) -> list[dict]:
    return historico.historico_no(no_id, limite)


# --- monitoramento ---------------------------------------------------------------------------


@app.get("/monitoramento/execucoes")
def monitoramento_execucoes(
    limite: int = Query(20, ge=1, le=100),
    airflow: ClienteAirflow = Depends(obter_airflow),
) -> list[dict]:
    try:
        return airflow.execucoes(limite=limite)
    except AirflowIndisponivel as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


@app.get("/monitoramento/execucoes/{run_id}/tarefas")
def monitoramento_tarefas(run_id: str, airflow: ClienteAirflow = Depends(obter_airflow)) -> list:
    try:
        return airflow.tarefas(run_id)
    except AirflowIndisponivel as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


# --- painel de etapas ------------------------------------------------------------------------


@app.get("/etapas")
def etapas(
    leitor: LeitorArtefatos = Depends(obter_leitor),
    historico: Historico = Depends(obter_historico),
    airflow: ClienteAirflow = Depends(obter_airflow),
) -> dict:
    """Situação de cada etapa do pipeline, da extração à visualização."""
    manifest = _manifest(leitor)
    catalogo_atual = montar_catalogo(manifest)
    execucao_dbt = _ultima_execucao(leitor, historico)
    sources = _opcional(leitor, "sources.json")
    frescor = resumir_frescor(sources, manifest, datetime.now(UTC)) if sources else None

    ultima_run, tarefas, aviso_airflow = None, None, None
    try:
        runs = airflow.execucoes(limite=1)
        if runs:
            ultima_run = runs[0]
            tarefas = airflow.tarefas(ultima_run["id"])
    except AirflowIndisponivel as erro:
        aviso_airflow = str(erro)

    return {
        "execucao_airflow": ultima_run,
        "execucao_dbt": {k: execucao_dbt[k] for k in ("invocacao", "gerado_em", "duracao_s")}
        if execucao_dbt
        else None,
        "aviso_airflow": aviso_airflow,
        "etapas": montar_etapas(tarefas, execucao_dbt, frescor, catalogo_atual),
    }


# --- visualização ----------------------------------------------------------------------------


def _gold(funcao, *args):
    try:
        return funcao(*args)
    except DadosIndisponiveis as erro:
        raise HTTPException(status_code=503, detail=str(erro)) from erro


def _validar_indicador(indicador: str) -> str:
    if indicador not in INDICADORES_FOCUS:
        raise HTTPException(status_code=422, detail=f"indicador deve ser um de {INDICADORES_FOCUS}")
    return indicador


@app.get("/dados/indicadores")
def dados_indicadores(gold: FonteGold = Depends(obter_gold)) -> list[dict]:
    """Série mensal de Selic, dólar, IPCA, IGP-M e IPCA 12 meses (camada Gold)."""
    return _gold(gold.indicadores)


@app.get("/dados/expectativas")
def dados_expectativas(indicador: str = "IPCA", gold: FonteGold = Depends(obter_gold)) -> dict:
    """Expectativa do Focus x realizado, por mês-alvo e horizonte, e o erro médio por horizonte."""
    indicador = _validar_indicador(indicador)
    return {
        "indicador": indicador,
        "serie": _gold(gold.expectativas, indicador),
        "erro_por_horizonte": _gold(gold.erro_por_horizonte, indicador),
    }
