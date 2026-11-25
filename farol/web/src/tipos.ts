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
