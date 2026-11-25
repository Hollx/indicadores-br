import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from farol_api import main
from farol_api.artefatos import LeitorArtefatos
from farol_api.catalogo import montar_catalogo, montar_linhagem, resumir_cobertura

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def manifest():
    return json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))


@pytest.fixture
def cliente():
    main.app.dependency_overrides[main.obter_leitor] = lambda: LeitorArtefatos(FIXTURES)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def _por_nome(catalogo, nome):
    return next(r for r in catalogo if r["nome"] == nome)


def test_catalogo_traz_todas_as_camadas_em_ordem(manifest):
    catalogo = montar_catalogo(manifest)
    camadas = [r["camada"] for r in catalogo]
    assert camadas == sorted(camadas, key=["bronze", "silver", "gold", "consumo"].index)
    assert {r["tipo"] for r in catalogo} == {"source", "seed", "model", "exposure"}


def test_fonte_herda_meta_e_testes_por_coluna(manifest):
    fonte = _por_nome(montar_catalogo(manifest), "bronze.sgs_observacoes")
    assert fonte["dono"] == "Hollx"
    assert fonte["camada"] == "bronze"
    colunas = {c["nome"]: c for c in fonte["colunas"]}
    assert colunas["ingerido_em"]["testes"] == ["not_null"]
    assert colunas["valor_texto"]["testes"] == []


def test_teste_singular_conta_para_o_modelo(manifest):
    gold = _por_nome(montar_catalogo(manifest), "fct_indicadores_mensais")
    tipos = {t["tipo"] for t in gold["testes"]}
    assert "singular" in tipos
    assert gold["cobertura"] == {"colunas": 6, "documentadas": 6, "testadas": 1}


def test_exposicao_e_dono_vem_do_owner(manifest):
    exposicao = _por_nome(montar_catalogo(manifest), "Dashboard de indicadores (Evidence)")
    assert exposicao["camada"] == "consumo"
    assert exposicao["dono"] == "Hollx"


def test_linhagem_vai_da_fonte_ao_dashboard_sem_testes(manifest):
    linhagem = montar_linhagem(montar_catalogo(manifest))
    arestas = {(a["origem"], a["destino"]) for a in linhagem["arestas"]}
    assert (
        "source.indicadores_br.bronze.sgs_observacoes",
        "model.indicadores_br.stg_sgs__observacoes",
    ) in arestas
    assert (
        "model.indicadores_br.fct_indicadores_mensais",
        "exposure.indicadores_br.dashboard_indicadores",
    ) in arestas
    assert not any(n["id"].startswith("test.") for n in linhagem["nos"])


def test_resumo_de_cobertura(manifest):
    resumo = resumir_cobertura(montar_catalogo(manifest))
    assert resumo["recursos"] == 4
    assert resumo["exposicoes"] == 1
    assert resumo["com_dono"] == 4
    assert resumo["pct_colunas_documentadas"] == 100.0


def test_api_responde(cliente):
    assert cliente.get("/saude").json()["status"] == "ok"
    assert len(cliente.get("/catalogo", params={"camada": "silver"}).json()) == 2
    assert cliente.get("/catalogo/nao-existe").status_code == 404
    assert cliente.get("/linhagem").json()["arestas"]
    assert cliente.get("/governanca/resumo").json()["testes"] > 0


def test_api_sem_artefatos(tmp_path):
    main.app.dependency_overrides[main.obter_leitor] = lambda: LeitorArtefatos(tmp_path)
    try:
        cliente = TestClient(main.app)
        assert cliente.get("/saude").json() == {"status": "sem_artefatos"}
        assert cliente.get("/catalogo").status_code == 503
    finally:
        main.app.dependency_overrides.clear()
