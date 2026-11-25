"""Catálogo, linhagem e cobertura de governança a partir do manifest.json do dbt.

Funções puras: recebem o manifest já carregado (dict) e devolvem estruturas prontas
para a API. Nada aqui lê disco ou rede, o que deixa tudo testável com um manifest de exemplo.
"""

from __future__ import annotations

from typing import Any

# Tipos de recurso que aparecem no catálogo e na linhagem. Testes ficam de fora do grafo:
# eles entram como atributo de cada recurso (quantos testes, em quais colunas).
TIPOS_CATALOGO = ("source", "seed", "model", "snapshot", "exposure")
ORDEM_CAMADAS = {"fonte": 0, "bronze": 1, "silver": 2, "gold": 3, "consumo": 4}


def _meta(no: dict[str, Any]) -> dict[str, Any]:
    """Junta meta do nó e do config (o dbt 1.10+ grava nos dois lugares)."""
    return {**(no.get("meta") or {}), **((no.get("config") or {}).get("meta") or {})}


def _tags(no: dict[str, Any]) -> list[str]:
    tags = set(no.get("tags") or []) | set((no.get("config") or {}).get("tags") or [])
    return sorted(tags)


def _camada(no: dict[str, Any]) -> str:
    """Camada Medallion: meta.camada quando declarada, senão deduzida do tipo e do schema."""
    meta = _meta(no)
    if meta.get("camada"):
        return str(meta["camada"])
    tipo = no["resource_type"]
    if tipo == "exposure":
        return "consumo"
    if tipo == "source":
        return "fonte"
    return str(no.get("schema") or "desconhecida")


def _dono(no: dict[str, Any]) -> str | None:
    if no["resource_type"] == "exposure":
        owner = no.get("owner") or {}
        return owner.get("name") or owner.get("email")
    return _meta(no).get("dono")


def _testes_por_recurso(manifest: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Mapeia cada recurso para os testes que o cobrem (genéricos por coluna e singulares)."""
    testes: dict[str, list[dict[str, Any]]] = {}
    for no in manifest.get("nodes", {}).values():
        if no.get("resource_type") != "test":
            continue
        metadata = no.get("test_metadata") or {}
        coluna = no.get("column_name") or (metadata.get("kwargs") or {}).get("column_name")
        alvo = no.get("attached_node")
        # Teste singular (SQL em tests/) não tem attached_node: vale para todos os pais.
        alvos = [alvo] if alvo else list(no.get("depends_on", {}).get("nodes", []))
        for recurso in alvos:
            testes.setdefault(recurso, []).append(
                {
                    "id": no["unique_id"],
                    "nome": no["name"],
                    "tipo": metadata.get("name") or "singular",
                    "coluna": coluna,
                }
            )
    return testes


def _recursos(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    nos = [
        *manifest.get("sources", {}).values(),
        *manifest.get("nodes", {}).values(),
        *manifest.get("exposures", {}).values(),
    ]
    return [no for no in nos if no.get("resource_type") in TIPOS_CATALOGO]


def montar_catalogo(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    """Uma entrada por recurso, com colunas, testes e cobertura de documentação."""
    testes = _testes_por_recurso(manifest)
    filhos = manifest.get("child_map", {})
    pais = manifest.get("parent_map", {})
    catalogo = []
    for no in _recursos(manifest):
        uid = no["unique_id"]
        testes_no = testes.get(uid, [])
        colunas_testadas = {t["coluna"] for t in testes_no if t["coluna"]}
        colunas = [
            {
                "nome": c["name"],
                "descricao": c.get("description") or "",
                "tipo_dado": c.get("data_type"),
                "testes": sorted(t["tipo"] for t in testes_no if t["coluna"] == c["name"]),
            }
            for c in (no.get("columns") or {}).values()
        ]
        documentadas = sum(1 for c in colunas if c["descricao"].strip())
        nome = no.get("label") or no["name"]
        if no["resource_type"] == "source":
            nome = f"{no['source_name']}.{no['name']}"
        catalogo.append(
            {
                "id": uid,
                "nome": nome,
                "tipo": no["resource_type"],
                "camada": _camada(no),
                "descricao": (no.get("description") or "").strip(),
                "dono": _dono(no),
                "tags": _tags(no),
                "meta": _meta(no),
                "materializacao": (no.get("config") or {}).get("materialized"),
                "relacao": no.get("relation_name"),
                "url": no.get("url"),
                "colunas": colunas,
                "testes": testes_no,
                "cobertura": {
                    "colunas": len(colunas),
                    "documentadas": documentadas,
                    "testadas": len(colunas_testadas),
                },
                "pais": [p for p in pais.get(uid, []) if not p.startswith("test.")],
                "filhos": [f for f in filhos.get(uid, []) if not f.startswith("test.")],
            }
        )
    catalogo.sort(key=lambda r: (ORDEM_CAMADAS.get(r["camada"], 9), r["nome"]))
    return catalogo


def montar_linhagem(catalogo: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Grafo de linhagem: nós do catálogo e arestas pai → filho, sem testes."""
    ids = {r["id"] for r in catalogo}
    nos = [
        {"id": r["id"], "nome": r["nome"], "tipo": r["tipo"], "camada": r["camada"]}
        for r in catalogo
    ]
    arestas = [
        {"origem": pai, "destino": r["id"]}
        for r in catalogo
        for pai in r["pais"]
        if pai in ids
    ]
    return {"nos": nos, "arestas": arestas}


def _pct(parte: int, total: int) -> float | None:
    return round(100 * parte / total, 1) if total else None


def resumir_cobertura(catalogo: list[dict[str, Any]]) -> dict[str, Any]:
    """Indicadores de governança do projeto inteiro e por camada."""
    dados = [r for r in catalogo if r["tipo"] != "exposure"]
    colunas = sum(r["cobertura"]["colunas"] for r in dados)
    documentadas = sum(r["cobertura"]["documentadas"] for r in dados)
    testadas = sum(r["cobertura"]["testadas"] for r in dados)

    por_camada: dict[str, dict[str, int]] = {}
    for r in dados:
        c = por_camada.setdefault(r["camada"], {"recursos": 0, "colunas": 0, "documentadas": 0})
        c["recursos"] += 1
        c["colunas"] += r["cobertura"]["colunas"]
        c["documentadas"] += r["cobertura"]["documentadas"]

    return {
        "recursos": len(dados),
        "exposicoes": sum(1 for r in catalogo if r["tipo"] == "exposure"),
        "com_dono": sum(1 for r in dados if r["dono"]),
        "com_descricao": sum(1 for r in dados if r["descricao"]),
        "com_testes": sum(1 for r in dados if r["testes"]),
        "testes": len({t["id"] for r in dados for t in r["testes"]}),
        "colunas": colunas,
        "pct_colunas_documentadas": _pct(documentadas, colunas),
        "pct_colunas_testadas": _pct(testadas, colunas),
        "por_camada": [
            {"camada": camada, **v, "pct_documentadas": _pct(v["documentadas"], v["colunas"])}
            for camada, v in sorted(
                por_camada.items(), key=lambda kv: ORDEM_CAMADAS.get(kv[0], 9)
            )
        ],
    }
