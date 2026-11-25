"""Histórico das execuções do dbt em SQLite.

O dbt sobrescreve run_results.json a cada rodada. O Farol guarda um retrato de cada execução
(chave: invocation_id) para mostrar tendência de testes e duração ao longo do tempo.
"""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

ESQUEMA = """
create table if not exists execucoes (
    invocacao   text primary key,
    gerado_em   text not null,
    comando     text,
    duracao_s   real,
    ok          integer,
    aviso       integer,
    falha       integer,
    testes      integer,
    testes_falha integer
);
create table if not exists resultados (
    invocacao   text not null references execucoes(invocacao),
    no_id       text not null,
    tipo        text,
    situacao    text,
    tempo_s     real,
    falhas      integer,
    primary key (invocacao, no_id)
);
create index if not exists idx_resultados_no on resultados(no_id);
"""


class Historico:
    def __init__(self, caminho: Path | str):
        self.caminho = str(caminho)
        with closing(self._conectar()) as conexao, conexao:
            conexao.executescript(ESQUEMA)

    def _conectar(self) -> sqlite3.Connection:
        conexao = sqlite3.connect(self.caminho)
        conexao.row_factory = sqlite3.Row
        return conexao

    def registrar(self, execucao: dict[str, Any]) -> bool:
        """Grava a execução se ainda não existir. Retorna True quando gravou."""
        if not execucao.get("invocacao") or not execucao.get("gerado_em"):
            return False
        with closing(self._conectar()) as conexao, conexao:
            cursor = conexao.execute(
                "insert or ignore into execucoes values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    execucao["invocacao"],
                    execucao["gerado_em"],
                    execucao.get("comando"),
                    execucao.get("duracao_s"),
                    execucao["contagem"]["ok"],
                    execucao["contagem"]["aviso"],
                    execucao["contagem"]["falha"],
                    execucao["testes"]["total"],
                    execucao["testes"]["falha"],
                ),
            )
            if cursor.rowcount == 0:
                return False
            conexao.executemany(
                "insert or ignore into resultados values (?, ?, ?, ?, ?, ?)",
                [
                    (
                        execucao["invocacao"],
                        no["id"],
                        no["tipo"],
                        no["situacao"],
                        no["tempo_s"],
                        no["falhas"],
                    )
                    for no in execucao["nos"]
                ],
            )
        return True

    def execucoes(self, limite: int = 30) -> list[dict[str, Any]]:
        """Execuções mais recentes primeiro."""
        with closing(self._conectar()) as conexao:
            linhas = conexao.execute(
                "select * from execucoes order by gerado_em desc limit ?", (limite,)
            ).fetchall()
        return [dict(linha) for linha in linhas]

    def historico_no(self, no_id: str, limite: int = 30) -> list[dict[str, Any]]:
        """Situação de um nó (teste ou modelo) nas últimas execuções."""
        with closing(self._conectar()) as conexao:
            linhas = conexao.execute(
                """
                select e.gerado_em, r.situacao, r.tempo_s, r.falhas
                from resultados r join execucoes e using (invocacao)
                where r.no_id = ?
                order by e.gerado_em desc
                limit ?
                """,
                (no_id, limite),
            ).fetchall()
        return [dict(linha) for linha in linhas]
