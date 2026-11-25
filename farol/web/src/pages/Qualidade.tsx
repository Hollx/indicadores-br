import { useMemo, useState } from "react";

import { Cartao, Indisponivel, Painel, Status, dataHora, duracao } from "../componentes";
import { useApi } from "../api";
import GraficoBarras from "../graficos/GraficoBarras";
import type { ExecucaoDbt, ExecucaoHistorico, Frescor } from "../tipos";

const FILTROS = ["todos", "falha", "aviso", "ok"] as const;

function nomeRecurso(id: string | null) {
  return id ? id.split(".").slice(2).join(".") : "—";
}

function UltimaExecucao() {
  const { dados, erro, carregando } = useApi<ExecucaoDbt>("/qualidade/execucao");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todos");
  const testes = useMemo(() => (dados?.nos ?? []).filter((n) => n.tipo === "test"), [dados]);
  const modelos = useMemo(() => (dados?.nos ?? []).filter((n) => n.tipo !== "test"), [dados]);

  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} />;

  const visiveis = testes
    .filter((t) => filtro === "todos" || t.situacao === filtro)
    .sort(
      (a, b) =>
        ["falha", "aviso", "ok", "ignorado"].indexOf(a.situacao) -
        ["falha", "aviso", "ok", "ignorado"].indexOf(b.situacao),
    );
  const pct = dados.testes.total ? (100 * dados.testes.ok) / dados.testes.total : 0;

  return (
    <>
      <div className="cartoes">
        <Cartao
          rotulo="Última execução do dbt"
          valor={dataHora(dados.gerado_em)}
          detalhe={`${dados.comando ?? "?"} · ${duracao(dados.duracao_s)}`}
        />
        <Cartao
          rotulo="Testes aprovados"
          valor={`${dados.testes.ok}/${dados.testes.total}`}
          detalhe={`${pct.toFixed(0)}%`}
        />
        <Cartao
          rotulo="Testes com falha"
          valor={String(dados.testes.falha)}
          detalhe={`${dados.testes.aviso} com aviso`}
        />
        <Cartao
          rotulo="Tabelas construídas"
          valor={String(modelos.filter((m) => m.situacao === "ok").length)}
          detalhe={`de ${modelos.length}`}
        />
      </div>

      <Painel
        titulo="Testes de qualidade"
        acao={
          <div className="segmentado" role="group" aria-label="Filtrar testes">
            {FILTROS.map((f) => (
              <button key={f} className={f === filtro ? "ativo" : undefined} onClick={() => setFiltro(f)}>
                {f}
              </button>
            ))}
          </div>
        }
      >
        <div className="rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Situação</th>
                <th>Teste</th>
                <th>Tabela</th>
                <th>Coluna</th>
                <th className="num">Falhas</th>
                <th className="num">Tempo</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Status situacao={t.situacao} />
                  </td>
                  <td className="codigo quebra">{t.nome}</td>
                  <td className="codigo">{nomeRecurso(t.recurso)}</td>
                  <td className="codigo">{t.coluna ?? "—"}</td>
                  <td className="num">{t.falhas ?? "—"}</td>
                  <td className="num">{t.tempo_s.toFixed(1)} s</td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="vazio">
                    Nenhum teste nessa situação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Painel>
    </>
  );
}

function FrescorFontes() {
  const { dados, erro, carregando } = useApi<Frescor>("/qualidade/frescor");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} />;
  return (
    <div className="rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th>Situação</th>
            <th>Fonte</th>
            <th>Último dado</th>
            <th className="num">Há quanto tempo</th>
            <th>Combinado</th>
          </tr>
        </thead>
        <tbody>
          {dados.fontes.map((f) => (
            <tr key={f.id}>
              <td>
                <Status situacao={f.situacao} />
              </td>
              <td className="codigo">{f.nome}</td>
              <td>{dataHora(f.ultimo_dado_em)}</td>
              <td className="num">{f.horas_desde_ultimo_dado ?? f.atraso_horas ?? "—"} h</td>
              <td>
                aviso após {f.aviso_apos?.count} h · erro após {f.erro_apos?.count} h
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Historico() {
  const { dados, erro, carregando } = useApi<ExecucaoHistorico[]>("/qualidade/historico?limite=20");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} />;
  if (dados.length < 2)
    return (
      <p className="estado">
        {dados.length} execução registrada. O histórico cresce a cada execução do dbt que o Farol lê.
      </p>
    );
  const ordem = [...dados].reverse();
  return (
    <GraficoBarras
      cor="var(--falha)"
      casas={0}
      rotuloX="testes com falha por execução"
      barras={ordem.map((e) => ({
        rotulo: new Date(e.gerado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: e.testes_falha,
        dica: `${dataHora(e.gerado_em)}: ${e.testes_falha} de ${e.testes} testes falharam, ${duracao(e.duracao_s)}`,
      }))}
    />
  );
}

export default function Qualidade() {
  return (
    <section>
      <h1>Qualidade</h1>
      <p className="subtitulo">
        Cada teste do dbt na última execução, o frescor das fontes e o histórico de falhas entre execuções.
      </p>
      <UltimaExecucao />
      <Painel titulo="Frescor das fontes">
        <FrescorFontes />
      </Painel>
      <Painel titulo="Histórico">
        <Historico />
      </Painel>
    </section>
  );
}
