import { useId, type ReactNode } from "react";

/** Termos técnicos explicados em uma frase, para quem não é da área. */
export const GLOSSARIO = {
  pipeline: "A esteira automática que busca os dados, organiza e entrega prontos para análise, todo dia.",
  airflow:
    "Apache Airflow: o agendador que dispara cada etapa do pipeline na ordem certa e registra se deu certo.",
  dbt: "dbt: a ferramenta que transforma os dados com SQL e roda testes de qualidade a cada execução.",
  bigquery: "Google BigQuery: o banco de dados na nuvem onde as tabelas ficam guardadas.",
  bronze: "Bronze: a primeira camada, com os dados exatamente como chegaram da fonte.",
  silver: "Silver: a camada com os dados limpos, tipados e sem duplicidade.",
  gold: "Gold: a camada final, com tabelas prontas para gráficos e análises.",
  teste: "Teste de qualidade: uma regra verificada automaticamente, como 'não pode haver mês repetido'.",
  frescor: "Frescor: há quanto tempo chegou o dado mais recente, comparado ao prazo combinado.",
  linhagem: "Linhagem: o caminho de cada dado, da fonte até o gráfico, mostrando quem depende de quem.",
  governanca:
    "Governança: saber o que existe, quem é o dono, o que cada coluna significa e o que está testado.",
  focus: "Boletim Focus: pesquisa semanal do Banco Central com as projeções de bancos e consultorias.",
  selic: "Selic: a taxa básica de juros da economia, definida pelo Banco Central.",
  ipca: "IPCA: o índice oficial de inflação do Brasil, medido pelo IBGE.",
  igpm: "IGP-M: índice de preços da FGV, muito usado para reajustar aluguéis.",
  execucao: "Execução: uma rodada completa do pipeline, do início ao fim.",
} as const;

export type Termo = keyof typeof GLOSSARIO;

/** Palavra com explicação: aparece ao passar o mouse ou focar com o teclado. */
export function Termo({ id, children }: { id: Termo; children: ReactNode }) {
  const dica = useId();
  return (
    <span className="termo" tabIndex={0} aria-describedby={dica}>
      {children}
      <span role="tooltip" id={dica} className="termo-dica">
        {GLOSSARIO[id]}
      </span>
    </span>
  );
}

/** Bloco recolhível "O que é isto?", com a explicação da tela em linguagem simples. */
export function Explica({ titulo = "O que é isto?", children }: { titulo?: string; children: ReactNode }) {
  return (
    <details className="explica">
      <summary>{titulo}</summary>
      <div className="explica-corpo">{children}</div>
    </details>
  );
}
