/**
 * Conteúdo do portfólio. Cada fato aqui vem do CV do autor (ou foi confirmado por ele);
 * nada da empresa é publicado além do que o CV já diz: sem nomes de clientes, sistemas internos
 * ou números de negócio.
 */

export const AUTOR = {
  nome: "Diego Obara",
  cargo: "Engenheiro de Dados",
  frase:
    "Construo e mantenho pipelines de dados com Python, SQL e Apache NiFi, um Data Warehouse em arquitetura Medallion no BigQuery, governança com OpenMetadata e camadas analíticas em Looker e Tableau.",
  linkedin: "https://www.linkedin.com/in/diego-obara-8988181a6",
  github: "https://github.com/Hollx",
};

export type Caso = {
  id: string;
  titulo: string;
  problema: string;
  feito: string[];
  resultado: string;
  ferramentas: string[];
  /** Onde algo parecido pode ser visto funcionando no Farol. */
  noFarol?: { href: string; texto: string };
};

export type Cargo = {
  empresa: string;
  cargo: string;
  periodo: string;
  resumo: string;
};

export const CARGOS: Cargo[] = [
  {
    empresa: "Visto Tecnologia",
    cargo: "Engenheiro de Dados",
    periodo: "2025 – hoje",
    resumo:
      "Pipelines ETL/ELT, Data Warehouse no BigQuery, governança de dados, APIs e ferramentas internas para as áreas de negócio.",
  },
  {
    empresa: "Visto Tecnologia",
    cargo: "Analista de Service Desk",
    periodo: "2022 – 2025",
    resumo:
      "Suporte técnico pelo Jira Service Management, automação de processos internos e consolidação de dados de inventário para relatórios gerenciais. Foi aqui que comecei a trabalhar com dados.",
  },
];

export const FORMACAO = [
  "Tecnólogo em Banco de Dados, Universidade Cruzeiro do Sul (2020 – 2024)",
  "Técnico em Hardware e Redes, Data Byte (2015)",
];

/** Números agregados do trabalho com dados (sem clientes nem códigos de chamado). */
export const EM_NUMEROS = [
  { valor: "383", rotulo: "entregas de dados", detalhe: "jan/2025 a jul/2026" },
  { valor: "21", rotulo: "entregas por mês", detalhe: "em média" },
  { valor: "2 dias", rotulo: "prazo mediano", detalhe: "31% resolvidas no mesmo dia" },
  { valor: "30%", rotulo: "das entregas são relatórios", detalhe: "118 de 386 chamados" },
];

export const CASOS: Caso[] = [
  {
    id: "assistente",
    titulo: "Assistente de dados em linguagem natural, em produção",
    problema:
      "Responder em português a perguntas sobre os dados da empresa, consultando o Data Warehouse, sem que o modelo de IA invente números.",
    feito: [
      "Assistente text-to-SQL em FastAPI e Docker com provedor de LLM trocável, hoje com 6 domínios de dados em produção.",
      "Princípio do desenho: o LLM nunca é a fonte de um dado. Validação, permissões e números saem do código.",
      "Validador que aceita só SELECT em tabelas autorizadas, com teto de bytes por domínio.",
      "Suíte de avaliação com 87 casos de SQL e 36 de roteamento entre domínios, rodando em segundos.",
      "Em andamento: um analista autônomo (planeja, consulta, lê e decide o próximo passo), avaliado com investigações de resposta conhecida tiradas de chamados reais, com critérios determinísticos e sem LLM como juiz.",
    ],
    resultado:
      "86 de 87 casos de SQL e 36 de 36 de roteamento corretos. Bugs encontrados pela suíte levaram o acerto de 88% para 98%, e o prompt ficou 14% mais barato por rodada.",
    ferramentas: ["LLM", "FastAPI", "Docker", "BigQuery", "Python"],
  },
  {
    id: "migracao",
    titulo: "Migração de relatórios legados para o BigQuery, provando que nada mudou",
    problema:
      "Relatórios de clientes enterprise viviam em procedures de SQL Server e Tableau e precisavam ir para o BigQuery e o Looker Studio sem mudar nenhum resultado.",
    feito: [
      "Reescrevi as procedures como views e tabelas nas camadas Silver e Gold do BigQuery.",
      "Criei uma metodologia de validação: diff por chave antes do diff por linha, EXCEPT DISTINCT nos dois sentidos, e a regra de que total agregado bater não prova fidelidade.",
      "Validei completude, frescor e granularidade, com reconciliação linha a linha entre o legado e a versão nova.",
    ],
    resultado:
      "Migrações com 0 processo faltando e 99,97% das linhas idênticas ao legado. Ao corrigir uma regressão, a nova regra reproduziu o legado em 99,963% dos casos, contra 99,70% da versão anterior, consumindo 35 GB em vez de 55,4 GB por execução.",
    ferramentas: ["SQL Server", "BigQuery", "SQL", "Looker Studio", "Arquitetura Medallion"],
    noFarol: { href: "#/qualidade", texto: "Validação automática de dados, como nos testes do Farol" },
  },
  {
    id: "dam",
    titulo: "Fim da perda silenciosa de dados na ingestão de um DAM multi-cliente",
    problema:
      "A carga incremental de um sistema de gestão de arquivos (DAM) perdia aprovações: o campo de data usado no filtro não mudava quando um arquivo era aprovado.",
    feito: [
      "Auditei 29 clientes comparando origem e destino por contagem e por assinatura MD5 dos identificadores.",
      "Medi o custo de ler direto do banco de origem (PostgreSQL) com EXPLAIN ANALYZE antes de decidir.",
      "Troquei a leitura pelo índice de busca por carga completa inicial e incremental direto do banco, com MERGE em lote no BigQuery.",
    ],
    resultado:
      "146.536 arquivos iguais à origem, sem nenhum faltando e sem campo divergente. A prova do MERGE teve 0 divergência.",
    ferramentas: ["PostgreSQL", "Apache NiFi", "BigQuery", "SQL"],
    noFarol: { href: "#/qualidade", texto: "Frescor e conferência de dados, como no Farol" },
  },
  {
    id: "onboarding",
    titulo: "Ingestão de um cliente novo configurada em YAML, sem montar fluxos à mão",
    problema:
      "Cada cliente tem o seu sistema de processos (BPM) sobre MySQL, e as extrações desse banco para o BigQuery precisavam ser replicadas cliente a cliente.",
    feito: [
      "Script em Python que clona a topologia de ingestão de um cliente de referência pela REST API do Apache NiFi, a partir de um YAML por cliente, com simulação (dry-run) por padrão.",
      "Sobe carga completa, carga incremental e reconciliação de registros apagados.",
    ],
    resultado:
      "Cargas conferidas contra a origem: 87.424 linhas sem duplicata num cliente e 935.345 linhas para 935.345 identificadores em outro.",
    ferramentas: ["Apache NiFi", "Python", "REST API", "YAML", "MySQL", "BigQuery"],
  },
  {
    id: "permissoes",
    titulo: "Permissões em massa num sistema de processos, com prova antes da carga",
    problema:
      "Criar papéis e vínculos de acesso para um cliente inteiro direto no banco operacional, sem errar.",
    feito: [
      "Mapeei o modelo de papéis e grupos e escrevi um gerador de SQL.",
      "Testei em um modelo antes da carga completa e incluí uma etapa de verificação.",
      "Medi antes de carregar: 73% dos vínculos seriam de usuários desativados, e eles ficaram de fora.",
    ],
    resultado: "247 papéis e 22.991 vínculos criados de uma vez, com verificação.",
    ferramentas: ["SQL", "Python"],
  },
  {
    id: "ci-views",
    titulo: "Deploy seguro de views no BigQuery (prova de conceito)",
    problema:
      "Publicar mudanças em views do BigQuery sem quebrar o schema nem aumentar o custo das consultas.",
    feito: [
      "Pipeline no GitLab CI com Workload Identity Federation, sem chave de serviço guardada.",
      "Três travas: só SELECT, dry-run obrigatório e nenhuma coluna pode sumir ou mudar de tipo.",
      "Backup de cada definição por 90 dias, restauração automática se a conferência falha e publicação na ordem bronze, silver e gold.",
    ],
    resultado:
      "Prova de conceito funcionando: a pipeline validou e publicou views de verdade. O próximo passo é cobrir todos os datasets.",
    ferramentas: ["GitLab CI", "BigQuery", "Workload Identity Federation"],
    noFarol: { href: "#/execucoes", texto: "Execuções verificadas e monitoradas, como no Farol" },
  },
  {
    id: "governanca",
    titulo: "Governança, linhagem e catálogo de metadados",
    problema: "Saber quais dados existem, de onde vêm e o que cada campo significa.",
    feito: ["Implementei governança, linhagem e catalogação de metadados com OpenMetadata."],
    resultado: "Metadados e linhagem rastreáveis para os times.",
    ferramentas: ["OpenMetadata"],
    noFarol: { href: "#/catalogo", texto: "Catálogo e linhagem, como no Farol" },
  },
  {
    id: "relatorios",
    titulo: "Relatórios em Excel gerados por uma API",
    problema: "Gerar relatórios em Excel a partir de consultas ao Data Warehouse de forma repetível.",
    feito: [
      "API REST em FastAPI que executa consultas BigQuery definidas em YAML e gera relatórios Excel (pandas, openpyxl), com endpoints de geração e download.",
    ],
    resultado: "Relatórios gerados sob demanda a partir de consultas definidas em YAML.",
    ferramentas: ["FastAPI", "Python", "pandas", "BigQuery"],
  },
  {
    id: "conhecimento",
    titulo: "Base de conhecimento de engenharia de dados como código",
    problema: "Não perder decisões, erros já resolvidos e padrões de trabalho entre um projeto e outro.",
    feito: [
      "Cofre de notas versionado com decisões de arquitetura, registro de erros, padrões e playbooks.",
      "Validador em Python rodando antes de cada commit para conferir estrutura, identificadores e links.",
    ],
    resultado:
      "Um lugar único com as decisões, os erros resolvidos e os padrões, conferido automaticamente a cada mudança.",
    ferramentas: ["Python", "Git", "Markdown"],
  },
];
