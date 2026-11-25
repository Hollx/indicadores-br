import { REPOSITORIO } from "../App";
import { useApi } from "../api";
import { Cartao, Indisponivel, Status, TituloTela, duracao, quando } from "../componentes";
import { Explica, Termo } from "../glossario";
import { data, formatarNumero, rotuloMes } from "../graficos/escalas";
import type { Etapa, ExecucaoDbt, LinhaIndicadores, PainelEtapas, Resumo } from "../tipos";

/** A pergunta que cada parada da rota responde, em linguagem simples. */
const PERGUNTA_DA_ETAPA: Record<string, string> = {
  extracao: "Os dados foram buscados no Banco Central?",
  bronze: "Chegaram ao banco de dados?",
  frescor: "Estão em dia?",
  silver: "Foram limpos e testados?",
  gold: "Estão prontos para análise?",
  visualizacao: "Viraram gráficos?",
};

function frase(painel: PainelEtapas, execucaoDbt: ExecucaoDbt | null) {
  const problemas = painel.etapas.filter((e) => e.situacao === "falha");
  const atencao = painel.etapas.filter((e) => e.situacao === "aviso");
  const rodando = painel.execucao_airflow?.situacao === "rodando";
  const quandoRodou = painel.execucao_airflow ? quando(painel.execucao_airflow.inicio) : null;
  const testes = execucaoDbt
    ? `${execucaoDbt.testes.ok} de ${execucaoDbt.testes.total} testes de qualidade passaram`
    : null;

  if (problemas.length) {
    return (
      <>
        <Status situacao="falha" />
        {`${problemas.map((e) => e.titulo).join(" e ")} ${problemas.length > 1 ? "tiveram" : "teve"} problema na última execução. `}
        Os detalhes estão na rota abaixo.
      </>
    );
  }
  if (rodando) {
    return (
      <>
        <Status situacao="rodando" />O pipeline está rodando agora (começou {quandoRodou}).
        {testes && ` Na execução anterior, ${testes}.`}
      </>
    );
  }
  if (atencao.length) {
    return (
      <>
        <Status situacao="aviso" />
        {`Pede atenção: ${atencao.map((e) => e.titulo.toLowerCase()).join(" e ")}. `}
        {quandoRodou && `O pipeline rodou ${quandoRodou}.`}
      </>
    );
  }
  return (
    <>
      <Status situacao="ok" rotulo="Tudo certo" />
      {quandoRodou ? `O pipeline rodou ${quandoRodou}` : "O pipeline está em dia"}
      {testes ? ` e ${testes}.` : "."}
    </>
  );
}

function Parada({ etapa, ordem }: { etapa: Etapa; ordem: number }) {
  return (
    <li className={`parada parada-${etapa.situacao}`}>
      <div className="parada-cabeca">
        <span className="parada-numero">{ordem}</span>
        <Status situacao={etapa.situacao} />
      </div>
      <h3>{etapa.titulo}</h3>
      <p className="parada-pergunta">{PERGUNTA_DA_ETAPA[etapa.id] ?? etapa.descricao}</p>
      <ul className="parada-detalhes">
        {etapa.detalhes.length ? (
          etapa.detalhes.slice(0, 3).map((d) => <li key={d}>{d}</li>)
        ) : (
          <li className="vazio">sem informação</li>
        )}
      </ul>
    </li>
  );
}

function ultimo(linhas: LinhaIndicadores[], campo: keyof LinhaIndicadores) {
  for (let i = linhas.length - 1; i >= 0; i--) {
    const v = linhas[i][campo];
    if (typeof v === "number") return { valor: v, mes: linhas[i].mes };
  }
  return { valor: null, mes: null };
}

function Hoje() {
  const { dados, erro, carregando } = useApi<LinhaIndicadores[]>("/dados/indicadores");
  if (carregando) return <p className="estado">Carregando…</p>;
  if (erro || !dados) return <Indisponivel erro={erro} oQue="O resumo dos indicadores" />;
  const selic = ultimo(dados, "selic_meta_media");
  const ipca = ultimo(dados, "ipca_acumulado_12m");
  const dolar = ultimo(dados, "dolar_compra_medio");
  const juro = selic.valor !== null && ipca.valor !== null ? selic.valor - ipca.valor : null;
  const mes = (m: string | null) => (m ? rotuloMes(data(m)) : "—");
  return (
    <div className="cartoes">
      <Cartao
        rotulo={<Termo id="selic">Juros (Selic)</Termo>}
        valor={
          <>
            {formatarNumero(selic.valor)}
            <small>% ao ano</small>
          </>
        }
        detalhe={`média de ${mes(selic.mes)}`}
      />
      <Cartao
        rotulo={<Termo id="ipca">Inflação em 12 meses</Termo>}
        valor={
          <>
            {formatarNumero(ipca.valor)}
            <small>%</small>
          </>
        }
        detalhe={`IPCA até ${mes(ipca.mes)}`}
      />
      <Cartao
        rotulo="Juro real"
        valor={
          <>
            {formatarNumero(juro)}
            <small>pontos</small>
          </>
        }
        detalhe="Selic menos a inflação de 12 meses"
      />
      <Cartao
        rotulo="Dólar"
        valor={
          <>
            <small>R$</small> {formatarNumero(dolar.valor)}
          </>
        }
        detalhe={`média de ${mes(dolar.mes)}`}
      />
    </div>
  );
}

const PERGUNTAS = [
  {
    href: "#/indicadores",
    pergunta: "Como estão os juros, a inflação e o dólar?",
    resposta: "Séries mês a mês desde 2021, com o valor mais recente em destaque.",
    tela: "Indicadores",
  },
  {
    href: "#/indicadores",
    pergunta: "O mercado acerta a inflação?",
    resposta: "O que os bancos previam no Boletim Focus contra o que de fato aconteceu.",
    tela: "Indicadores",
  },
  {
    href: "#/execucoes",
    pergunta: "O pipeline rodou hoje? Quanto tempo levou?",
    resposta: "Cada execução diária, com a duração e a etapa que falhou, se alguma falhou.",
    tela: "Execuções",
  },
  {
    href: "#/qualidade",
    pergunta: "Dá para confiar nesses números?",
    resposta: "Cada regra de qualidade verificada automaticamente e se os dados estão em dia.",
    tela: "Qualidade",
  },
  {
    href: "#/catalogo",
    pergunta: "Que tabelas existem e o que cada coluna significa?",
    resposta: "O catálogo com dono, descrição e testes de cada tabela.",
    tela: "Catálogo",
  },
  {
    href: "#/linhagem",
    pergunta: "De onde vem cada número?",
    resposta: "O caminho do dado, da API do Banco Central até o gráfico.",
    tela: "Linhagem",
  },
];

const PILHA = [
  { nome: "Apache Airflow", papel: "agenda e executa" },
  { nome: "dbt", papel: "transforma e testa" },
  { nome: "Google BigQuery", papel: "guarda as tabelas" },
  { nome: "Terraform", papel: "cria a infraestrutura" },
  { nome: "FastAPI", papel: "serve os dados ao Farol" },
  { nome: "React + TypeScript", papel: "telas e gráficos" },
  { nome: "Docker", papel: "roda tudo na VPS" },
  { nome: "GitHub Actions", papel: "testa cada mudança" },
];

export default function VisaoGeral() {
  const painel = useApi<PainelEtapas>("/etapas");
  const execucao = useApi<ExecucaoDbt>("/qualidade/execucao");
  const resumo = useApi<Resumo>("/governanca/resumo");

  return (
    <>
      <TituloTela
        titulo="Visão geral"
        achado={
          painel.dados
            ? frase(painel.dados, execucao.dados)
            : painel.carregando
              ? "Verificando o pipeline…"
              : null
        }
      >
        <Explica titulo="O que é o Farol?">
          <p>
            O Farol acompanha um <Termo id="pipeline">pipeline de dados</Termo> que, todo dia, busca os juros,
            a inflação, o dólar e as projeções do mercado no Banco Central, organiza tudo em um banco de dados
            na nuvem e transforma em gráficos.
          </p>
          <p>
            Além de mostrar os números, ele mostra se dá para confiar neles: se a coleta de hoje funcionou, se
            as regras de qualidade passaram e de onde vem cada informação. É o tipo de painel que uma equipe
            de dados usa para cuidar dos dados de uma empresa, aqui feito com dados públicos.
          </p>
        </Explica>
      </TituloTela>

      <section className="secao" aria-labelledby="rota-titulo">
        <div className="secao-topo">
          <h2 id="rota-titulo">A rota do dado, na última execução</h2>
          {painel.dados?.execucao_airflow && (
            <p>
              {quando(painel.dados.execucao_airflow.inicio)} ·{" "}
              {duracao(painel.dados.execucao_airflow.duracao_s)}
            </p>
          )}
        </div>
        {painel.erro ? (
          <Indisponivel erro={painel.erro} oQue="A situação do pipeline" />
        ) : (
          <ol className="rota">
            {(painel.dados?.etapas ?? []).map((e, i) => (
              <Parada key={e.id} etapa={e} ordem={i + 1} />
            ))}
          </ol>
        )}
        <p className="nota" style={{ marginTop: 10 }}>
          As etapas seguem a arquitetura em camadas: <Termo id="bronze">Bronze</Termo> (dado bruto),{" "}
          <Termo id="silver">Silver</Termo> (dado limpo) e <Termo id="gold">Gold</Termo> (dado pronto para
          análise).
        </p>
      </section>

      <section className="secao" aria-labelledby="hoje-titulo">
        <div className="secao-topo">
          <h2 id="hoje-titulo">O que os dados dizem hoje</h2>
          <a href="#/indicadores">Ver os gráficos</a>
        </div>
        <Hoje />
      </section>

      <section className="secao" aria-labelledby="perguntas-titulo">
        <div className="secao-topo">
          <h2 id="perguntas-titulo">Perguntas que o Farol responde</h2>
        </div>
        <div className="perguntas">
          {PERGUNTAS.map((p) => (
            <a key={p.pergunta} className="pergunta" href={p.href}>
              <strong>{p.pergunta}</strong>
              <span>{p.resposta}</span>
              <em>{p.tela} →</em>
            </a>
          ))}
        </div>
      </section>

      <section className="secao" aria-labelledby="pilha-titulo">
        <div className="secao-topo">
          <h2 id="pilha-titulo">Como foi construído</h2>
          <a href={REPOSITORIO} target="_blank" rel="noreferrer">
            Ver o código
          </a>
        </div>
        <p className="nota">
          Custo zero: tudo roda em uma VPS própria e no nível gratuito do BigQuery.
          {resumo.dados &&
            ` Hoje são ${resumo.dados.recursos} tabelas e fontes, ${resumo.dados.testes} testes de qualidade e ${formatarNumero(resumo.dados.pct_colunas_documentadas, 0)}% das colunas documentadas.`}
        </p>
        <ul className="pilha">
          {PILHA.map((p) => (
            <li key={p.nome} className="pilha-item">
              <strong>{p.nome}</strong>
              <span>{p.papel}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
