import copy
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from farol_api import main
from farol_api.artefatos import LeitorArtefatos
from farol_api.catalogo import montar_catalogo
from farol_api.dados import DadosIndisponiveis, FonteGold
from farol_api.etapas import montar_etapas, pior
from farol_api.historico import Historico
from farol_api.monitoramento import AirflowIndisponivel, ClienteAirflow
from farol_api.qualidade import classificar, resumir_execucao, resumir_frescor

FIXTURES = Path(__file__).parent / "fixtures"


def _ler(nome):
    return json.loads((FIXTURES / nome).read_text(encoding="utf-8"))


@pytest.fixture
def manifest():
    return _ler("manifest.json")


@pytest.fixture
def run_results():
    return _ler("run_results.json")


# --- qualidade -------------------------------------------------------------------------------


def test_classificar_status_do_dbt():
    assert [classificar(s) for s in ("pass", "success", "warn", "fail", "error", "skipped")] == [
        "ok",
        "ok",
        "aviso",
        "falha",
        "falha",
        "ignorado",
    ]


def test_resumo_da_execucao(run_results, manifest):
    execucao = resumir_execucao(run_results, manifest)
    assert execucao["comando"] == "build"
    assert execucao["testes"]["total"] == execucao["testes"]["ok"] > 0
    teste = next(n for n in execucao["nos"] if n["tipo"] == "test" and n["coluna"] == "serie_id")
    assert teste["recurso"].startswith(("model.", "seed.", "source."))


def test_teste_que_falhou_aparece_como_falha(run_results, manifest):
    alterado = copy.deepcopy(run_results)
    alvo = next(r for r in alterado["results"] if r["unique_id"].startswith("test."))
    alvo.update(status="fail", failures=3)
    execucao = resumir_execucao(alterado, manifest)
    assert execucao["testes"]["falha"] == 1
    assert execucao["contagem"]["falha"] == 1


def test_frescor(manifest):
    frescor = resumir_frescor(_ler("sources.json"), manifest)
    fonte = frescor["fontes"][0]
    assert fonte["nome"] == "bronze.sgs_observacoes"
    assert fonte["situacao"] == "ok"
    assert fonte["aviso_apos"] == {"count": 26, "period": "hour"}
    assert fonte["horas_desde_ultimo_dado"] is None
    from datetime import UTC, datetime

    agora = datetime(2026, 11, 6, 18, 55, 30, tzinfo=UTC)
    depois = resumir_frescor(_ler("sources.json"), manifest, agora)["fontes"][0]
    assert depois["horas_desde_ultimo_dado"] == 24.0
    assert depois["situacao"] == "ok"
    muito_depois = datetime(2026, 11, 8, 18, 55, 30, tzinfo=UTC)  # 72 h: passou do erro (50 h)
    parado = resumir_frescor(_ler("sources.json"), manifest, muito_depois)["fontes"][0]
    assert parado["situacao"] == "falha"
    assert parado["situacao_na_verificacao"] == "ok"


def test_historico_registra_uma_vez(tmp_path, run_results, manifest):
    historico = Historico(tmp_path / "farol.db")
    execucao = resumir_execucao(run_results, manifest)
    assert historico.registrar(execucao) is True
    assert historico.registrar(execucao) is False
    assert len(historico.execucoes()) == 1
    teste = next(n for n in execucao["nos"] if n["tipo"] == "test")
    assert historico.historico_no(teste["id"])[0]["situacao"] == "ok"


# --- monitoramento ---------------------------------------------------------------------------


def _airflow_falso(estado_extrair="success"):
    def responder(requisicao: httpx.Request) -> httpx.Response:
        caminho = requisicao.url.path
        if caminho == "/auth/token":
            return httpx.Response(201, json={"access_token": "t"})
        assert requisicao.headers["Authorization"] == "Bearer t"
        if caminho.endswith("/dagRuns"):
            return httpx.Response(
                200,
                json={
                    "dag_runs": [
                        {
                            "dag_run_id": "scheduled__2026-11-25",
                            "state": "success",
                            "run_type": "scheduled",
                            "run_after": "2026-11-25T09:00:00Z",
                            "start_date": "2026-11-25T09:00:05Z",
                            "end_date": "2026-11-25T09:04:05Z",
                        }
                    ]
                },
            )
        if caminho.endswith("/taskInstances"):

            def ti(tarefa, mapa, estado, inicio, fim):
                return {
                    "task_id": tarefa,
                    "map_index": mapa,
                    "state": estado,
                    "try_number": 1,
                    "start_date": f"2026-11-25T09:0{inicio}:00Z",
                    "end_date": f"2026-11-25T09:0{fim}:00Z",
                }

            return httpx.Response(
                200,
                json={
                    "task_instances": [
                        ti("extrair", 0, "success", 0, 1),
                        ti("extrair", 1, estado_extrair, 0, 2),
                        ti("carregar", -1, "success", 2, 3),
                        ti("dbt_build", -1, "success", 3, 4),
                    ]
                },
            )
        return httpx.Response(404)

    return ClienteAirflow(
        "http://airflow:8080",
        "admin",
        "x",
        http=httpx.Client(transport=httpx.MockTransport(responder)),
    )


def test_execucoes_do_airflow():
    execucoes = _airflow_falso().execucoes()
    assert execucoes[0]["situacao"] == "ok"
    assert execucoes[0]["duracao_s"] == 240.0


def test_tarefas_mapeadas_sao_agrupadas_pela_pior_situacao():
    tarefas = {t["tarefa"]: t for t in _airflow_falso("failed").tarefas("x")}
    assert tarefas["extrair"]["instancias"] == 2
    assert tarefas["extrair"]["situacao"] == "falha"
    assert tarefas["extrair"]["duracao_s"] == 120.0


def test_airflow_sem_url():
    with pytest.raises(AirflowIndisponivel):
        ClienteAirflow(None).execucoes()


# --- etapas ----------------------------------------------------------------------------------


def test_pior_situacao():
    assert pior(["ok", "aviso", "ignorado"]) == "aviso"
    assert pior(["ignorado"]) == "sem_dados"


def test_etapas_juntam_airflow_e_dbt(run_results, manifest):
    catalogo = montar_catalogo(manifest)
    execucao = resumir_execucao(run_results, manifest)
    tarefas = _airflow_falso("failed").tarefas("x")
    frescor = resumir_frescor(_ler("sources.json"), manifest)
    etapas = {e["id"]: e for e in montar_etapas(tarefas, execucao, frescor, catalogo)}
    assert list(etapas) == ["extracao", "bronze", "frescor", "silver", "gold", "visualizacao"]
    assert etapas["extracao"]["situacao"] == "falha"
    assert "extrair: 1/2 ok, 1 falha" in etapas["extracao"]["detalhes"]
    assert etapas["bronze"]["situacao"] == "ok"
    assert etapas["silver"]["situacao"] == "ok"
    assert etapas["gold"]["situacao"] == "ok"
    assert etapas["visualizacao"]["situacao"] == "ok"


def test_etapas_sem_nada_ficam_sem_dados(manifest):
    etapas = montar_etapas(None, None, None, montar_catalogo(manifest))
    assert {e["situacao"] for e in etapas} == {"sem_dados"}


# --- dados -----------------------------------------------------------------------------------


def test_fonte_gold_usa_cache_e_parametros():
    chamadas = []

    def executor(sql, parametros):
        chamadas.append((sql, parametros))
        return [{"horizonte_meses": 0}]

    gold = FonteGold("projeto-exemplo", executor)
    gold.erro_por_horizonte("IPCA")
    gold.erro_por_horizonte("IPCA")
    assert len(chamadas) == 1
    sql, parametros = chamadas[0]
    assert "`projeto-exemplo.gold.fct_expectativa_vs_realizado`" in sql
    assert parametros == {"indicador": "IPCA"}


def test_fonte_gold_sem_projeto():
    with pytest.raises(DadosIndisponiveis):
        FonteGold(None).indicadores()


# --- API -------------------------------------------------------------------------------------


@pytest.fixture
def cliente(tmp_path):
    main.app.dependency_overrides.update(
        {
            main.obter_leitor: lambda: LeitorArtefatos(FIXTURES),
            main.obter_historico: lambda: Historico(tmp_path / "farol.db"),
            main.obter_airflow: _airflow_falso,
            main.obter_gold: lambda: FonteGold("p", lambda sql, params: [{"ok": 1}]),
        }
    )
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_endpoints(cliente):
    assert cliente.get("/qualidade/execucao").json()["testes"]["total"] > 0
    assert len(cliente.get("/qualidade/historico").json()) == 1
    assert cliente.get("/qualidade/frescor").json()["fontes"]
    assert cliente.get("/monitoramento/execucoes").json()[0]["situacao"] == "ok"
    etapas = cliente.get("/etapas").json()
    assert etapas["aviso_airflow"] is None
    assert len(etapas["etapas"]) == 6
    assert cliente.get("/dados/indicadores").json() == [{"ok": 1}]
    assert cliente.get("/dados/expectativas", params={"indicador": "IGP-M"}).status_code == 200
    assert cliente.get("/dados/expectativas", params={"indicador": "Selic"}).status_code == 422


def test_etapas_sem_airflow(cliente):
    main.app.dependency_overrides[main.obter_airflow] = lambda: ClienteAirflow(None)
    resposta = cliente.get("/etapas").json()
    assert "AIRFLOW_URL" in resposta["aviso_airflow"]
