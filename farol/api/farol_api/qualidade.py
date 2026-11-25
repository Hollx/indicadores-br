"""Qualidade: resultado de cada nó da última execução do dbt e frescor das fontes.

Funções puras sobre os artefatos do dbt (run_results.json, sources.json e manifest.json).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

# Status do dbt agrupados no que importa para quem opera o pipeline.
STATUS_OK = {"pass", "success"}
STATUS_AVISO = {"warn"}
STATUS_FALHA = {"fail", "error", "runtime error"}


def classificar(status: str | None) -> str:
    """Traduz o status do dbt para ok / aviso / falha / ignorado."""
    if status in STATUS_OK:
        return "ok"
    if status in STATUS_AVISO:
        return "aviso"
    if status in STATUS_FALHA:
        return "falha"
    return "ignorado"


def _no(manifest: dict[str, Any], uid: str) -> dict[str, Any]:
    return (
        manifest.get("nodes", {}).get(uid)
        or manifest.get("sources", {}).get(uid)
        or {"name": uid.split(".")[-1], "resource_type": uid.split(".")[0]}
    )


def _alvo_do_teste(no: dict[str, Any]) -> str | None:
    """Recurso que o teste verifica: attached_node, ou o primeiro pai (teste singular)."""
    if no.get("attached_node"):
        return no["attached_node"]
    pais = no.get("depends_on", {}).get("nodes", [])
    return pais[0] if pais else None


def resumir_execucao(run_results: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    """Uma execução do dbt (build, run ou test): contagens e um item por nó executado."""
    metadata = run_results.get("metadata", {})
    nos = []
    for resultado in run_results.get("results", []):
        uid = resultado["unique_id"]
        no = _no(manifest, uid)
        tipo = no.get("resource_type") or uid.split(".")[0]
        resposta = resultado.get("adapter_response") or {}
        nos.append(
            {
                "id": uid,
                "nome": no.get("name", uid),
                "tipo": tipo,
                "status": resultado.get("status"),
                "situacao": classificar(resultado.get("status")),
                "tempo_s": round(resultado.get("execution_time") or 0, 2),
                "falhas": resultado.get("failures"),
                "mensagem": resultado.get("message"),
                "linhas": resposta.get("rows_affected"),
                "bytes_processados": resposta.get("bytes_processed"),
                "recurso": _alvo_do_teste(no) if tipo == "test" else uid,
                "coluna": no.get("column_name") if tipo == "test" else None,
            }
        )

    contagem = {"ok": 0, "aviso": 0, "falha": 0, "ignorado": 0}
    for item in nos:
        contagem[item["situacao"]] += 1

    testes = [n for n in nos if n["tipo"] == "test"]
    return {
        "invocacao": metadata.get("invocation_id"),
        "gerado_em": metadata.get("generated_at"),
        "iniciado_em": metadata.get("invocation_started_at"),
        "comando": (run_results.get("args") or {}).get("which"),
        "duracao_s": round(run_results.get("elapsed_time") or 0, 1),
        "contagem": contagem,
        "testes": {
            "total": len(testes),
            "ok": sum(1 for t in testes if t["situacao"] == "ok"),
            "aviso": sum(1 for t in testes if t["situacao"] == "aviso"),
            "falha": sum(1 for t in testes if t["situacao"] == "falha"),
        },
        "nos": nos,
    }


def _para_datetime(texto: str | None) -> datetime | None:
    if not texto:
        return None
    return datetime.fromisoformat(texto.replace("Z", "+00:00"))


SEGUNDOS_POR_PERIODO = {"minute": 60, "hour": 3600, "day": 86400}


def _limite_horas(criterio: dict[str, Any] | None) -> float | None:
    if (
        not criterio
        or not criterio.get("count")
        or criterio.get("period") not in SEGUNDOS_POR_PERIODO
    ):
        return None
    return criterio["count"] * SEGUNDOS_POR_PERIODO[criterio["period"]] / 3600


def situacao_atual(horas: float | None, aviso: dict | None, erro: dict | None) -> str | None:
    """Reavalia o frescor com a hora de agora: dado parado vira aviso/falha mesmo se o dbt
    disse 'pass' quando verificou (a verificação pode ter sido há dias)."""
    if horas is None:
        return None
    limite_erro, limite_aviso = _limite_horas(erro), _limite_horas(aviso)
    if limite_erro is not None and horas > limite_erro:
        return "falha"
    if limite_aviso is not None and horas > limite_aviso:
        return "aviso"
    return "ok"


def resumir_frescor(
    sources: dict[str, Any], manifest: dict[str, Any], agora: datetime | None = None
) -> dict[str, Any]:
    """Frescor de cada fonte: quando chegou o último dado e se está dentro do combinado.

    `atraso_horas` é o atraso medido pelo dbt na verificação; `horas_desde_ultimo_dado` é o
    atraso agora (quando `agora` é informado), que é o que interessa para monitorar.
    """
    fontes = []
    for resultado in sources.get("results", []):
        uid = resultado["unique_id"]
        no = manifest.get("sources", {}).get(uid, {})
        criterio = resultado.get("criteria") or {}
        atraso_s = resultado.get("max_loaded_at_time_ago_in_s")
        horas_agora = horas_desde(resultado.get("max_loaded_at"), agora) if agora else None
        situacao_dbt = classificar(resultado.get("status"))
        agora_sit = situacao_atual(
            horas_agora, criterio.get("warn_after"), criterio.get("error_after")
        )
        ordem = ["falha", "aviso", "ok", "ignorado"]
        situacao = min([situacao_dbt, agora_sit or situacao_dbt], key=ordem.index)
        fontes.append(
            {
                "id": uid,
                "nome": f"{no.get('source_name', '?')}.{no.get('name', uid.split('.')[-1])}",
                "status": resultado.get("status"),
                "situacao": situacao,
                "situacao_na_verificacao": situacao_dbt,
                "ultimo_dado_em": resultado.get("max_loaded_at"),
                "verificado_em": resultado.get("snapshotted_at"),
                "atraso_horas": round(atraso_s / 3600, 1) if atraso_s is not None else None,
                "horas_desde_ultimo_dado": horas_agora,
                "aviso_apos": criterio.get("warn_after"),
                "erro_apos": criterio.get("error_after"),
            }
        )
    metadata = sources.get("metadata", {})
    return {"gerado_em": metadata.get("generated_at"), "fontes": fontes}


def horas_desde(texto: str | None, agora: datetime) -> float | None:
    momento = _para_datetime(texto)
    if momento is None:
        return None
    return round((agora - momento).total_seconds() / 3600, 1)
