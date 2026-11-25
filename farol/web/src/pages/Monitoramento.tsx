import { useState } from "react";

import { Indisponivel, Painel, Status, dataHora, duracao } from "../componentes";
import { useApi } from "../api";
import GraficoBarras from "../graficos/GraficoBarras";
import type { ExecucaoAirflow, TarefaAirflow } from "../tipos";

function Tarefas({ runId }: { runId: string }) {
  const { dados, erro, carregando } = useApi<TarefaAirflow[]>(
    `/monitoramento/execucoes/${encodeURIComponent(runId)}/tarefas`,
  );
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} />;

  const inicios = dados
    .map((t) => t.inicio)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  const fins = dados
    .map((t) => t.fim)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  const t0 = Math.min(...inicios);
  const total = Math.max(...fins) - t0 || 1;

  return (
    <div className="rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th>Situação</th>
            <th>Tarefa</th>
            <th className="num">Instâncias</th>
            <th className="num">Tentativas</th>
            <th className="num">Duração</th>
            <th className="linha-tempo-col">Linha do tempo</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((t) => {
            const ini = t.inicio ? new Date(t.inicio).getTime() : null;
            const fim = t.fim ? new Date(t.fim).getTime() : null;
            return (
              <tr key={t.tarefa}>
                <td>
                  <Status situacao={t.situacao} />
                </td>
                <td className="codigo">{t.tarefa}</td>
                <td className="num">{t.instancias}</td>
                <td className="num">{t.tentativas}</td>
                <td className="num">{duracao(t.duracao_s)}</td>
                <td className="linha-tempo-col">
                  {ini !== null && fim !== null && Number.isFinite(t0) && (
                    <div className="linha-tempo">
                      <div
                        className={`linha-tempo-barra fundo-${t.situacao}`}
                        style={{
                          left: `${((ini - t0) / total) * 100}%`,
                          width: `${Math.max(((fim - ini) / total) * 100, 1)}%`,
                        }}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Monitoramento() {
  const { dados, erro, carregando } = useApi<ExecucaoAirflow[]>("/monitoramento/execucoes?limite=20");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  if (carregando) return <p className="estado">Carregando…</p>;

  const atual = selecionada ?? dados?.[0]?.id ?? null;
  const ordem = [...(dados ?? [])].reverse();

  return (
    <section>
      <h1>Monitoramento</h1>
      <p className="subtitulo">
        Execuções do DAG <span className="codigo">indicadores_br</span> no Airflow: quanto duraram, quais
        etapas falharam e quantas vezes cada tarefa precisou ser repetida.
      </p>
      {erro || !dados ? (
        <Indisponivel erro={erro} />
      ) : (
        <>
          <Painel titulo="Duração das execuções (minutos)">
            <GraficoBarras
              casas={1}
              barras={ordem.map((r) => ({
                rotulo: r.inicio
                  ? new Date(r.inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : "?",
                valor: r.duracao_s !== null ? r.duracao_s / 60 : null,
                destaque: r.id === atual,
                cor: r.situacao === "falha" ? "var(--falha)" : undefined,
                dica: `${dataHora(r.inicio)}: ${r.estado}, ${duracao(r.duracao_s)}`,
              }))}
            />
          </Painel>
          <div className="grade-lista">
            <Painel titulo="Execuções">
              <ul className="lista">
                {dados.map((r) => (
                  <li key={r.id}>
                    <button
                      className={r.id === atual ? "ativo" : undefined}
                      onClick={() => setSelecionada(r.id)}
                    >
                      <Status situacao={r.situacao} />
                      <span className="lista-nome">{dataHora(r.inicio ?? r.agendada_para)}</span>
                      <span className="lista-tipo">{r.tipo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Painel>
            <Painel titulo="Tarefas da execução">
              {atual ? <Tarefas runId={atual} /> : <p className="estado">Nenhuma execução.</p>}
            </Painel>
          </div>
        </>
      )}
    </section>
  );
}
