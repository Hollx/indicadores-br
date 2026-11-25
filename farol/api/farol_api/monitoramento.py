"""Monitoramento: execuções do DAG e de cada tarefa, lidas da API REST do Airflow 3.

Só leitura (GET). O token vem de POST /auth/token do simple auth manager do Airflow 3.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

DAG_PADRAO = "indicadores_br"

# Estados do Airflow agrupados como no resto do Farol.
SITUACAO_AIRFLOW = {
    "success": "ok",
    "failed": "falha",
    "upstream_failed": "falha",
    "up_for_retry": "aviso",
    "running": "rodando",
    "queued": "rodando",
    "scheduled": "rodando",
    "deferred": "rodando",
    "restarting": "rodando",
    "skipped": "ignorado",
    "removed": "ignorado",
}


def situacao(estado: str | None) -> str:
    return SITUACAO_AIRFLOW.get(estado or "", "sem_dados")


def _duracao(inicio: str | None, fim: str | None) -> float | None:
    if not inicio or not fim:
        return None
    a = datetime.fromisoformat(inicio.replace("Z", "+00:00"))
    b = datetime.fromisoformat(fim.replace("Z", "+00:00"))
    return round((b - a).total_seconds(), 1)


class AirflowIndisponivel(RuntimeError):
    """Airflow não configurado ou fora do ar."""


class ClienteAirflow:
    def __init__(
        self,
        url: str | None,
        usuario: str | None = None,
        senha: str | None = None,
        http: httpx.Client | None = None,
    ):
        self.url = (url or "").rstrip("/")
        self.usuario = usuario
        self.senha = senha
        self.http = http or httpx.Client(timeout=10)
        self._token: str | None = None

    @property
    def configurado(self) -> bool:
        return bool(self.url)

    def _autenticar(self) -> str:
        corpo = {"username": self.usuario, "password": self.senha} if self.usuario else {}
        resposta = self.http.post(f"{self.url}/auth/token", json=corpo)
        resposta.raise_for_status()
        return resposta.json()["access_token"]

    def _get(self, caminho: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.configurado:
            raise AirflowIndisponivel("AIRFLOW_URL não configurada")
        try:
            if self._token is None:
                self._token = self._autenticar()
            resposta = self.http.get(
                f"{self.url}{caminho}",
                params=params,
                headers={"Authorization": f"Bearer {self._token}"},
            )
            if resposta.status_code == 401:  # token expirado: renova uma vez
                self._token = self._autenticar()
                resposta = self.http.get(
                    f"{self.url}{caminho}",
                    params=params,
                    headers={"Authorization": f"Bearer {self._token}"},
                )
            resposta.raise_for_status()
            return resposta.json()
        except httpx.HTTPError as erro:
            raise AirflowIndisponivel(f"Airflow não respondeu: {erro}") from erro

    def execucoes(self, dag_id: str = DAG_PADRAO, limite: int = 20) -> list[dict[str, Any]]:
        """Execuções do DAG, da mais recente para a mais antiga."""
        dados = self._get(
            f"/api/v2/dags/{dag_id}/dagRuns", {"order_by": "-run_after", "limit": limite}
        )
        return [
            {
                "id": run["dag_run_id"],
                "estado": run.get("state"),
                "situacao": situacao(run.get("state")),
                "tipo": run.get("run_type"),
                "agendada_para": run.get("run_after") or run.get("logical_date"),
                "inicio": run.get("start_date"),
                "fim": run.get("end_date"),
                "duracao_s": _duracao(run.get("start_date"), run.get("end_date")),
            }
            for run in dados.get("dag_runs", [])
        ]

    def tarefas(self, run_id: str, dag_id: str = DAG_PADRAO) -> list[dict[str, Any]]:
        """Tarefas de uma execução. Tarefas mapeadas (uma por série) vêm agrupadas."""
        dados = self._get(f"/api/v2/dags/{dag_id}/dagRuns/{run_id}/taskInstances", {"limit": 100})
        grupos: dict[str, dict[str, Any]] = {}
        for ti in dados.get("task_instances", []):
            grupo = grupos.setdefault(
                ti["task_id"],
                {
                    "tarefa": ti["task_id"],
                    "instancias": 0,
                    "estados": {},
                    "inicio": None,
                    "fim": None,
                    "tentativas": 0,
                },
            )
            grupo["instancias"] += 1
            estado = ti.get("state") or "sem_estado"
            grupo["estados"][estado] = grupo["estados"].get(estado, 0) + 1
            grupo["tentativas"] = max(grupo["tentativas"], ti.get("try_number") or 0)
            if ti.get("start_date") and (not grupo["inicio"] or ti["start_date"] < grupo["inicio"]):
                grupo["inicio"] = ti["start_date"]
            if ti.get("end_date") and (not grupo["fim"] or ti["end_date"] > grupo["fim"]):
                grupo["fim"] = ti["end_date"]

        tarefas = []
        for grupo in grupos.values():
            estados = grupo["estados"]
            # A pior situação entre as instâncias define a do grupo.
            ordem = ["falha", "aviso", "rodando", "sem_dados", "ignorado", "ok"]
            pior = min((situacao(e) for e in estados), key=ordem.index)
            tarefas.append(
                {**grupo, "situacao": pior, "duracao_s": _duracao(grupo["inicio"], grupo["fim"])}
            )
        tarefas.sort(key=lambda t: t["inicio"] or "9999")
        return tarefas
