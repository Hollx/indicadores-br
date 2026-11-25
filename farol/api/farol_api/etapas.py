"""Painel de etapas: o pipeline de ponta a ponta, uma situação por etapa.

Junta o que o Airflow diz (tarefas da última execução), o que o dbt diz (nós e testes da
última execução, frescor das fontes) e o catálogo (camada de cada recurso).
"""

from __future__ import annotations

from typing import Any

ORDEM_GRAVIDADE = ["falha", "aviso", "rodando", "sem_dados", "ok", "ignorado"]

ETAPAS = [
    {
        "id": "extracao",
        "titulo": "Extração",
        "descricao": "APIs do Banco Central para o data lake",
        "tarefas": ["extrair", "extrair_focus"],
    },
    {
        "id": "bronze",
        "titulo": "Bronze",
        "descricao": "Carga bruta no BigQuery",
        "tarefas": ["carregar", "carregar_focus"],
    },
    {
        "id": "frescor",
        "titulo": "Frescor",
        "descricao": "Os dados chegaram no prazo?",
        "tarefas": ["dbt_source_freshness"],
    },
    {
        "id": "silver",
        "titulo": "Silver",
        "descricao": "Tipagem, deduplicação e testes",
        "tarefas": ["dbt_build"],
        "camada": "silver",
    },
    {
        "id": "gold",
        "titulo": "Gold",
        "descricao": "Tabelas analíticas e testes",
        "tarefas": ["dbt_build"],
        "camada": "gold",
    },
    {
        "id": "visualizacao",
        "titulo": "Visualização",
        "descricao": "Gráficos do Farol",
        "tarefas": [],
    },
]


def pior(situacoes: list[str]) -> str:
    validas = [s for s in situacoes if s != "ignorado"]
    if not validas:
        return "sem_dados"
    return min(validas, key=ORDEM_GRAVIDADE.index)


def montar_etapas(
    tarefas: list[dict[str, Any]] | None,
    execucao_dbt: dict[str, Any] | None,
    frescor: dict[str, Any] | None,
    catalogo: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    camada_de = {r["id"]: r["camada"] for r in catalogo}
    tarefas_por_id = {t["tarefa"]: t for t in (tarefas or [])}
    etapas = []

    for definicao in ETAPAS:
        situacoes: list[str] = []
        detalhes: list[str] = []

        for tarefa_id in definicao["tarefas"]:
            # dbt_build aparece em Silver e Gold; lá quem decide é o resultado do dbt.
            if definicao.get("camada"):
                break
            tarefa = tarefas_por_id.get(tarefa_id)
            if tarefa:
                situacoes.append(tarefa["situacao"])
                detalhes.append(
                    f"{tarefa_id}: {tarefa['instancias']} execução(ões), "
                    f"{', '.join(f'{n} {e}' for e, n in tarefa['estados'].items())}"
                )

        if definicao["id"] == "frescor" and frescor:
            for fonte in frescor["fontes"]:
                situacoes.append(fonte["situacao"])
                detalhes.append(f"{fonte['nome']}: último dado há {fonte['atraso_horas']} h")

        if definicao.get("camada") and execucao_dbt:
            nos = [
                n for n in execucao_dbt["nos"] if camada_de.get(n["recurso"]) == definicao["camada"]
            ]
            testes = [n for n in nos if n["tipo"] == "test"]
            modelos = [n for n in nos if n["tipo"] != "test"]
            situacoes.extend(n["situacao"] for n in nos)
            if nos:
                falhas = [n["nome"] for n in testes if n["situacao"] in ("falha", "aviso")]
                detalhes.append(
                    f"{len(modelos)} tabela(s) construída(s), "
                    f"{len(testes) - len(falhas)}/{len(testes)} testes ok"
                )
                detalhes.extend(f"teste com problema: {nome}" for nome in falhas)

        if definicao["id"] == "visualizacao":
            exposicoes = [r for r in catalogo if r["tipo"] == "exposure"]
            gold = next((e for e in etapas if e["id"] == "gold"), None)
            situacoes.append(gold["situacao"] if gold else "sem_dados")
            detalhes.extend(f"exposição: {r['nome']}" for r in exposicoes)

        etapas.append(
            {
                "id": definicao["id"],
                "titulo": definicao["titulo"],
                "descricao": definicao["descricao"],
                "situacao": pior(situacoes),
                "detalhes": detalhes,
            }
        )
    return etapas
