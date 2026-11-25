import { useMemo, useState } from "react";

import { Cartao, Indisponivel, Painel, Status, TituloTela, dataHora, duracao, quando } from "../componentes";
import { Explica, Termo } from "../glossario";
import { useApi } from "../api";
import GraficoBarras from "../graficos/GraficoBarras";
import type { ExecucaoDbt, ExecucaoHistorico, Frescor } from "../tipos";

const FILTROS = ["todos", "falha", "aviso", "ok"] as const;
const ROTULO_FILTRO: Record<(typeof FILTROS)[number], string> = {
  todos: "Todas",
  falha: "Com problema",
  aviso: "Atenção",
  ok: "Aprovadas",
};

/** Regras singulares (SQL em dbt/tests) explicadas em uma frase. */
const REGRA_SINGULAR: Record<string, string> = {
  assert_ipca_faixa_plausivel: "O IPCA de cada mês precisa estar numa faixa plausível",
  assert_sem_duplicidade_serie_data: "Cada série tem no máximo um valor por data",
};

/** Traduz o nome técnico do teste para uma frase: "valor não pode ficar vazio". */
function regraEmPortugues(nome: string, coluna: string | null): string {
  const c = coluna ?? "a combinação de colunas";
  if (/^(source_)?not_null_/.test(nome)) return `${c} não pode ficar vazio`;
  if (/^(source_)?unique_/.test(nome)) return `${c} não pode se repetir`;
  if (/^(source_)?accepted_values_/.test(nome)) return `${c} só aceita os valores previstos`;
  if (/^(source_)?relationships_/.test(nome)) return `${c} precisa existir no cadastro de séries`;
  if (/^combinacao_unica_/.test(nome)) return "Cada combinação que define a linha aparece uma vez só";
  return REGRA_SINGULAR[nome] ?? nome.replace(/_/g, " ");
}

function nomeRecurso(id: string | null) {
  return id ? id.split(".").slice(2).join(".") : "—";
}

function UltimaExecucao() {
  const { dados, erro, carregando } = useApi<ExecucaoDbt>("/qualidade/execucao");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("todos");
  const [todas, setTodas] = useState(false);
  const testes = useMemo(() => (dados?.nos ?? []).filter((n) => n.tipo === "test"), [dados]);
  const modelos = useMemo(
    () => (dados?.nos ?? []).filter((n) => ["model", "seed", "snapshot"].includes(n.tipo)),
    [dados],
  );

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
          rotulo="Última verificação"
          valor={quando(dados.gerado_em)}
          detalhe={`levou ${duracao(dados.duracao_s)}`}
        />
        <Cartao
          rotulo="Regras aprovadas"
          valor={`${dados.testes.ok}/${dados.testes.total}`}
          detalhe={`${pct.toFixed(0)}%`}
        />
        <Cartao
          rotulo="Regras com problema"
          valor={String(dados.testes.falha)}
          detalhe={dados.testes.aviso ? `${dados.testes.aviso} pedem atenção` : "nenhuma pede atenção"}
        />
        <Cartao
          rotulo="Tabelas construídas"
          valor={String(modelos.filter((m) => m.situacao === "ok").length)}
          detalhe={`de ${modelos.length}, na mesma execução`}
        />
      </div>

      <Painel
        titulo="As regras, uma a uma"
        descricao="Cada linha é uma regra conferida automaticamente na última execução, com a tabela e a coluna verificadas."
        acao={
          <div className="segmentado" role="group" aria-label="Filtrar testes">
            {FILTROS.map((f) => (
              <button
                key={f}
                className={f === filtro ? "ativo" : undefined}
                onClick={() => setFiltro(f)}
                aria-pressed={f === filtro}
              >
                {ROTULO_FILTRO[f]}
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
                <th>Regra</th>
                <th>Tabela</th>
                <th className="num">Linhas com erro</th>
              </tr>
            </thead>
            <tbody>
              {(todas ? visiveis : visiveis.slice(0, 8)).map((t) => (
                <tr key={t.id}>
                  <td>
                    <Status situacao={t.situacao} />
                  </td>
                  <td>
                    {regraEmPortugues(t.nome, t.coluna)}
                    <span className="tabela-sub codigo quebra">{t.nome}</span>
                  </td>
                  <td className="codigo">{nomeRecurso(t.recurso)}</td>
                  <td className="num">{t.falhas ?? "—"}</td>
                </tr>
              ))}
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={4} className="vazio">
                    Nenhuma regra nessa situação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visiveis.length > 8 && (
          <button className="botao-secundario" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
            {todas ? "Mostrar menos" : `Ver todas as ${visiveis.length} regras`}
          </button>
        )}
      </Painel>
    </>
  );
}

const NOME_FONTE: Record<string, string> = {
  "bronze.sgs_observacoes": "Juros, inflação e dólar (SGS)",
  "bronze.focus_expectativas_mensais": "Previsões do mercado (Boletim Focus)",
};

function haQuanto(horas: number | null | undefined): string {
  if (horas === null || horas === undefined) return "—";
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `há ${Math.round(horas)} h`;
  return `há ${Math.round(horas / 24)} dias`;
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
            <th>Último dado chegou</th>
            <th>Prazo combinado</th>
          </tr>
        </thead>
        <tbody>
          {dados.fontes.map((f) => (
            <tr key={f.id}>
              <td>
                <Status situacao={f.situacao} />
              </td>
              <td>
                {NOME_FONTE[f.nome] ?? f.nome}
                <span className="tabela-sub codigo">{f.nome}</span>
              </td>
              <td>
                {haQuanto(f.horas_desde_ultimo_dado ?? f.atraso_horas)}
                <span className="tabela-sub">{dataHora(f.ultimo_dado_em)}</span>
              </td>
              <td>
                atenção após {f.aviso_apos?.count} h, problema após {f.erro_apos?.count} h
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
      cor="var(--negative)"
      casas={0}
      rotuloX="testes com falha por execução"
      barras={ordem.map((e) => ({
        rotulo: new Date(e.gerado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: e.testes_falha,
        dica: `${dataHora(e.gerado_em)}: ${e.testes_falha} de ${e.testes} regras falharam, ${duracao(e.duracao_s)}`,
      }))}
    />
  );
}

function frase(e: ExecucaoDbt) {
  if (e.testes.falha) {
    return (
      <>
        <Status situacao="falha" />
        {`${e.testes.falha} de ${e.testes.total} regras de qualidade falharam na última verificação (${quando(e.gerado_em)}). Os números afetados não devem ser usados até a correção.`}
      </>
    );
  }
  if (e.testes.aviso) {
    return (
      <>
        <Status situacao="aviso" />
        {`${e.testes.aviso} regras pedem atenção; as outras ${e.testes.ok} passaram (${quando(e.gerado_em)}).`}
      </>
    );
  }
  return (
    <>
      <Status situacao="ok" rotulo="Dá para confiar" />
      {`As ${e.testes.total} regras de qualidade passaram na última verificação, ${quando(e.gerado_em)}.`}
    </>
  );
}

export default function Qualidade() {
  const { dados } = useApi<ExecucaoDbt>("/qualidade/execucao");
  return (
    <>
      <TituloTela titulo="Qualidade" achado={dados ? frase(dados) : null}>
        <Explica titulo="Como os dados são verificados?">
          <p>
            A cada execução, o <Termo id="dbt">dbt</Termo> confere regras automáticas sobre as tabelas, os{" "}
            <Termo id="teste">testes de qualidade</Termo>. Exemplos: nenhum mês pode aparecer duas vezes,
            nenhum valor pode vir vazio, a inflação precisa estar numa faixa plausível e todo indicador
            precisa existir no cadastro de séries.
          </p>
          <p>
            Também é medido o <Termo id="frescor">frescor</Termo>: se o dado mais recente chegou dentro do
            prazo combinado. Dado parado vira alerta, mesmo que todas as regras passem.
          </p>
        </Explica>
      </TituloTela>
      <UltimaExecucao />
      <Painel
        titulo="Os dados estão em dia?"
        descricao="Há quanto tempo chegou o dado mais recente de cada fonte, e o prazo combinado."
      >
        <FrescorFontes />
      </Painel>
      <Painel
        titulo="Histórico de verificações"
        descricao="Regras que falharam em cada execução registrada pelo Farol. Barras vazias são execuções sem nenhuma falha."
      >
        <Historico />
      </Painel>
    </>
  );
}
