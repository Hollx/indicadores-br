import { useState } from "react";

import { Indisponivel, Painel, Status, TituloTela, dataHora, duracao, quando } from "../componentes";
import { Explica, Termo } from "../glossario";
import { useApi } from "../api";
import GraficoBarras from "../graficos/GraficoBarras";
import type { ExecucaoAirflow, TarefaAirflow } from "../tipos";

const NOME_TAREFA: Record<string, string> = {
  extrair: "Buscar as séries do Banco Central",
  extrair_focus: "Buscar as previsões do Boletim Focus",
  carregar: "Carregar as séries no BigQuery",
  carregar_focus: "Carregar as previsões no BigQuery",
  dbt_source_freshness: "Conferir se os dados estão em dia",
  dbt_build: "Transformar e testar (dbt)",
};

const TIPO_EXECUCAO: Record<string, string> = {
  scheduled: "agendada",
  manual: "manual",
  backfill: "reprocesso",
};

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
            <th className="num">Partes</th>
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
                <td>
                  {NOME_TAREFA[t.tarefa] ?? t.tarefa}
                  <span className="tabela-sub codigo">{t.tarefa}</span>
                </td>
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
  const [todas, setTodas] = useState(false);

  if (carregando) return <p className="estado">Carregando…</p>;

  const atual = selecionada ?? dados?.[0]?.id ?? null;
  const ordem = [...(dados ?? [])].reverse();

  const ultima = dados?.[0];
  const falhas = (dados ?? []).filter((r) => r.situacao === "falha").length;
  const achado = ultima ? (
    <>
      <Status situacao={ultima.situacao} />
      {`A última execução foi ${quando(ultima.inicio ?? ultima.agendada_para)}`}
      {ultima.duracao_s !== null ? ` e levou ${duracao(ultima.duracao_s)}.` : "."}
      {` Nas últimas ${dados!.length} execuções, ${falhas === 0 ? "nenhuma falhou" : `${falhas} falharam`}.`}
    </>
  ) : null;

  return (
    <>
      <TituloTela titulo="Execuções" achado={achado}>
        <Explica titulo="O que é uma execução?">
          <p>
            Todo dia às 06:00 (horário de Brasília), o <Termo id="airflow">Airflow</Termo> dispara o pipeline:
            busca os dados, carrega no banco, verifica o frescor e roda as transformações e testes. Cada
            rodada completa é uma <Termo id="execucao">execução</Termo>.
          </p>
          <p>
            Escolha uma execução na lista para ver cada tarefa, quanto tempo levou e se precisou ser repetida.
            O Airflow tenta de novo sozinho quando uma API demora a responder.
          </p>
        </Explica>
      </TituloTela>
      {erro || !dados ? (
        <Indisponivel erro={erro} />
      ) : (
        <>
          <Painel
            titulo="Quanto tempo cada execução levou?"
            descricao="Duração em minutos. Barras vermelhas são execuções que falharam; a destacada é a selecionada abaixo."
          >
            <GraficoBarras
              casas={1}
              barras={ordem.map((r) => ({
                rotulo: r.inicio
                  ? new Date(r.inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : "?",
                valor: r.duracao_s !== null ? r.duracao_s / 60 : null,
                destaque: r.id === atual,
                cor:
                  r.situacao === "falha"
                    ? "var(--negative)"
                    : r.id === atual
                      ? "var(--chart-1)"
                      : "var(--chart-cinza)",
                dica: `${dataHora(r.inicio)}: ${r.estado}, ${duracao(r.duracao_s)}`,
              }))}
            />
          </Painel>
          <div className="grade-lista">
            <Painel titulo="Execuções recentes">
              <ul className="lista">
                {(todas ? dados : dados.slice(0, 8)).map((r) => (
                  <li key={r.id}>
                    <button
                      className={r.id === atual ? "ativo" : undefined}
                      onClick={() => setSelecionada(r.id)}
                    >
                      <Status situacao={r.situacao} />
                      <span className="lista-nome">{quando(r.inicio ?? r.agendada_para)}</span>
                      <span className="lista-tipo">{TIPO_EXECUCAO[r.tipo ?? ""] ?? r.tipo}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {dados.length > 8 && (
                <button
                  className="botao-secundario"
                  onClick={() => setTodas((v) => !v)}
                  aria-expanded={todas}
                >
                  {todas ? "Mostrar menos" : `Ver as ${dados.length} execuções`}
                </button>
              )}
            </Painel>
            <Painel
              titulo="O que aconteceu nessa execução"
              descricao="Cada tarefa, quanto tempo levou e se precisou ser repetida."
            >
              {atual ? <Tarefas runId={atual} /> : <p className="estado">Nenhuma execução.</p>}
            </Painel>
          </div>
        </>
      )}
    </>
  );
}
