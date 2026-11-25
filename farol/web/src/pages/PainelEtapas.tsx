import { Status, dataHora, duracao } from "../componentes";
import { useApi } from "../api";
import type { PainelEtapas as TPainel } from "../tipos";

export default function PainelEtapas() {
  const { dados, erro, carregando } = useApi<TPainel>("/etapas");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <p className="estado erro">Não foi possível carregar: {erro}</p>;

  const problemas = dados.etapas.filter((e) => e.situacao === "falha" || e.situacao === "aviso");

  return (
    <section>
      <h1>Painel do pipeline</h1>
      <p className="subtitulo">
        A situação de cada etapa, da extração das APIs do Banco Central até os gráficos. Junta a última
        execução do Airflow com o resultado do dbt.
      </p>

      <div className="faixa-info">
        <span>
          Airflow:{" "}
          {dados.execucao_airflow ? (
            <>
              <Status situacao={dados.execucao_airflow.situacao} /> {dataHora(dados.execucao_airflow.inicio)}{" "}
              · {duracao(dados.execucao_airflow.duracao_s)}
            </>
          ) : (
            <em className="vazio">{dados.aviso_airflow ?? "nenhuma execução"}</em>
          )}
        </span>
        <span>
          dbt:{" "}
          {dados.execucao_dbt ? (
            <>
              {dataHora(dados.execucao_dbt.gerado_em)} · {duracao(dados.execucao_dbt.duracao_s)}
            </>
          ) : (
            <em className="vazio">nenhuma execução</em>
          )}
        </span>
      </div>

      <ol className="etapas">
        {dados.etapas.map((etapa, i) => (
          <li key={etapa.id} className={`etapa etapa-${etapa.situacao}`}>
            <div className="etapa-topo">
              <span className="etapa-numero">{i + 1}</span>
              <Status situacao={etapa.situacao} />
            </div>
            <h3>{etapa.titulo}</h3>
            <p className="etapa-descricao">{etapa.descricao}</p>
            <ul className="etapa-detalhes">
              {etapa.detalhes.length ? (
                etapa.detalhes.map((d) => <li key={d}>{d}</li>)
              ) : (
                <li className="vazio">sem informação</li>
              )}
            </ul>
          </li>
        ))}
      </ol>

      <h2>Alertas</h2>
      {problemas.length === 0 ? (
        <p className="estado">Nenhuma etapa com falha ou aviso.</p>
      ) : (
        <ul className="alertas">
          {problemas.map((e) => (
            <li key={e.id}>
              <Status situacao={e.situacao} /> <strong>{e.titulo}</strong>: {e.detalhes.join(" · ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
