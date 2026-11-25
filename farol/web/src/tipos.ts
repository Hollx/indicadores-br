export type Coluna = {
  nome: string;
  descricao: string;
  tipo_dado: string | null;
  testes: string[];
};

export type Teste = { id: string; nome: string; tipo: string; coluna: string | null };

export type Recurso = {
  id: string;
  nome: string;
  tipo: "source" | "seed" | "model" | "snapshot" | "exposure";
  camada: string;
  descricao: string;
  dono: string | null;
  tags: string[];
  meta: Record<string, unknown>;
  materializacao: string | null;
  relacao: string | null;
  url: string | null;
  colunas: Coluna[];
  testes: Teste[];
  cobertura: { colunas: number; documentadas: number; testadas: number };
  pais: string[];
  filhos: string[];
};

export type Linhagem = {
  nos: Pick<Recurso, "id" | "nome" | "tipo" | "camada">[];
  arestas: { origem: string; destino: string }[];
};

export type Resumo = {
  recursos: number;
  exposicoes: number;
  com_dono: number;
  com_descricao: number;
  com_testes: number;
  testes: number;
  colunas: number;
  pct_colunas_documentadas: number | null;
  pct_colunas_testadas: number | null;
  por_camada: {
    camada: string;
    recursos: number;
    colunas: number;
    documentadas: number;
    pct_documentadas: number | null;
  }[];
};

export type Situacao = "ok" | "aviso" | "falha" | "rodando" | "sem_dados" | "ignorado";

export type NoExecutado = {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  situacao: Situacao;
  tempo_s: number;
  falhas: number | null;
  mensagem: string | null;
  linhas: number | null;
  bytes_processados: number | null;
  recurso: string | null;
  coluna: string | null;
};

export type ExecucaoDbt = {
  invocacao: string;
  gerado_em: string;
  comando: string | null;
  duracao_s: number;
  horas_desde: number | null;
  contagem: Record<"ok" | "aviso" | "falha" | "ignorado", number>;
  testes: { total: number; ok: number; aviso: number; falha: number };
  nos: NoExecutado[];
};

export type Frescor = {
  gerado_em: string;
  fontes: {
    id: string;
    nome: string;
    situacao: Situacao;
    ultimo_dado_em: string | null;
    atraso_horas: number | null;
    horas_desde_ultimo_dado: number | null;
    aviso_apos: { count: number; period: string } | null;
    erro_apos: { count: number; period: string } | null;
  }[];
};

export type ExecucaoHistorico = {
  invocacao: string;
  gerado_em: string;
  comando: string | null;
  duracao_s: number;
  ok: number;
  aviso: number;
  falha: number;
  testes: number;
  testes_falha: number;
};

export type ExecucaoAirflow = {
  id: string;
  estado: string | null;
  situacao: Situacao;
  tipo: string | null;
  agendada_para: string | null;
  inicio: string | null;
  fim: string | null;
  duracao_s: number | null;
};

export type TarefaAirflow = {
  tarefa: string;
  instancias: number;
  estados: Record<string, number>;
  situacao: Situacao;
  inicio: string | null;
  fim: string | null;
  duracao_s: number | null;
  tentativas: number;
};

export type Etapa = { id: string; titulo: string; descricao: string; situacao: Situacao; detalhes: string[] };

export type PainelEtapas = {
  execucao_airflow: ExecucaoAirflow | null;
  execucao_dbt: { invocacao: string; gerado_em: string; duracao_s: number } | null;
  aviso_airflow: string | null;
  etapas: Etapa[];
};

export type LinhaIndicadores = {
  mes: string;
  selic_meta_media: number | null;
  dolar_compra_medio: number | null;
  ipca_mensal: number | null;
  igpm_mensal: number | null;
  ipca_acumulado_12m: number | null;
};

export type Expectativas = {
  indicador: string;
  serie: {
    mes_referencia: string;
    horizonte_meses: number;
    mediana_esperada: number | null;
    minimo_esperado: number | null;
    maximo_esperado: number | null;
    realizado: number | null;
    erro: number | null;
    dentro_do_intervalo: boolean | null;
  }[];
  erro_por_horizonte: {
    horizonte_meses: number;
    meses: number;
    erro_medio: number;
    erro_absoluto_medio: number;
    pct_dentro_intervalo: number;
  }[];
};
