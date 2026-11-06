# indicadores-br: guia do projeto

Documento de referência do projeto: o que ele faz, como as peças se encaixam, o papel de cada ferramenta e o histórico do que foi construído e corrigido.

Atualizado em 06/11/2026.

---

## 1. Visão geral

O **indicadores-br** é um pipeline de dados de ponta a ponta, com custo zero, sobre indicadores econômicos públicos do Brasil:

| Indicador | Série SGS | Periodicidade | Unidade |
|---|---|---|---|
| Meta da taxa Selic (Copom) | 432 | diária | % a.a. |
| IPCA, variação mensal | 433 | mensal | % a.m. |
| Dólar comercial, compra (taxa livre) | 1 | diária | R$/US$ |
| IGP-M, variação mensal | 189 | mensal | % a.m. |

Todo dia o pipeline:
1. baixa as séries da API do Banco Central;
2. guarda os arquivos brutos;
3. carrega no BigQuery;
4. transforma e testa os dados com dbt;
5. publica tudo num dashboard escrito em código.

O objetivo é praticar e demonstrar, num repositório público, a stack moderna de engenharia de dados: orquestração, transformação, qualidade de dados, infraestrutura como código, CI e visualização.

- **Repositório:** https://github.com/Hollx/indicadores-br
- **Dashboard:** https://indicadores.173-212-242-68.sslip.io

---

## 2. Arquitetura

```
 API SGS do Banco Central (pública, sem chave)
          │  HTTP/JSON
          ▼
 ┌──────────────────────── VPS (Docker Compose) ────────────────────────┐
 │                                                                       │
 │  Airflow 3 ── DAG diária "indicadores_br" (09:00 UTC)                 │
 │    1. extrair  (4 tasks em paralelo, uma por série)                   │
 │         └─▶ data/raw/sgs/dt=AAAA-MM-DD/serie_N.ndjson  (data lake)    │
 │    2. carregar ─▶ load job no BigQuery (bronze)                       │
 │    3. dbt source freshness                                            │
 │    4. dbt build (modelos + testes)                                    │
 │                                                                       │
 │  Postgres 16 ── banco de metadados do Airflow                         │
 │                                                                       │
 │  Evidence (evidence serve) ── dashboard, consulta a Gold ao vivo      │
 │         ▲                                                             │
 │  Caddy (do projeto cadencia) ── HTTPS ─▶ internet                     │
 └───────────────────────────────────────────────────────────────────────┘
          │
          ▼
 Google BigQuery (sandbox, sem faturamento)
   bronze.sgs_observacoes        ← dado bruto (load job)
   silver.stg_sgs__observacoes   ← view: tipagem, dedup, catálogo
   silver.series_sgs             ← seed: catálogo das séries
   gold.fct_indicadores_mensais  ← tabela: um mês por linha

 Terraform ─▶ datasets, service accounts, IAM, cotas
 GitHub Actions ─▶ lint, testes, terraform validate, dbt parse
```

### Arquitetura Medallion (Bronze, Silver, Gold)

O dado avança por camadas, e cada uma tem uma responsabilidade:

| Camada | O que guarda | Como é materializada | Para quem |
|---|---|---|---|
| **Bronze** | Dado como veio da fonte: valor ainda em texto e data de ingestão | Tabela, substituída a cada carga | Reprocessamento e auditoria |
| **Silver** | Dado limpo: tipado, sem duplicatas e enriquecido com o catálogo das séries | View, recalculada a cada consulta | Engenharia e análise |
| **Gold** | Dado pronto para consumo: uma linha por mês, indicadores lado a lado, IPCA acumulado em 12 meses | Tabela | Dashboard e usuários finais |

---

## 3. O que acontece num dia de execução

1. **09:00 UTC (06:00 de Brasília):** o scheduler do Airflow cria uma execução da DAG `indicadores_br`.
2. **`extrair`:** 4 tasks rodam em paralelo, uma por série, criadas por *dynamic task mapping* (`expand`). Cada uma:
   - calcula a janela de histórico (padrão: 5 anos, configurável em `SGS_ANOS_HISTORICO`; a API aceita no máximo 10 anos por consulta);
   - chama `https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados`;
   - normaliza a resposta, com data ISO, valor em texto e carimbo `ingerido_em`;
   - grava em `data/raw/sgs/dt=<hoje>/serie_<codigo>.ndjson`.
3. **`carregar`:** junta os 4 arquivos e faz um *load job* no BigQuery para `bronze.sgs_observacoes` em modo `WRITE_TRUNCATE`, substituindo a tabela inteira.
4. **`dbt_source_freshness`:** confere se a Bronze foi atualizada há pouco tempo. Avisa acima de 26 h e falha acima de 50 h.
5. **`dbt_build`:** carrega o seed, reconstrói a Silver e a Gold e roda todos os testes de qualidade. Se um teste falha, a execução falha e aparece no Airflow.
6. **Dashboard:** não precisa de nenhum passo extra. O Evidence consulta a Gold ao vivo a cada visita, então os dados novos aparecem sozinhos.

Se uma task falha, o Airflow tenta de novo até 2 vezes, com 5 minutos de intervalo.

---

## 4. Ferramentas, processos e tecnologias

### 4.1 Fonte de dados: API SGS do Banco Central
O **SGS** (Sistema Gerenciador de Séries Temporais) é o catálogo de séries econômicas do BC. A API é pública, gratuita e sem chave, e devolve JSON no formato `{"data": "dd/mm/aaaa", "valor": "x,yy"}`.
**No projeto:** é a única fonte. O código está em `airflow/include/sgs.py`: funções puras, testáveis sem Airflow, com testes em `tests/test_sgs.py`.

### 4.2 Python e requests
Linguagem do extrator e do carregador. O `requests` faz as chamadas HTTP.
**No projeto:**
- `sgs.py`: baixar, normalizar e salvar em NDJSON;
- `bq_loader.py`: concatenar os arquivos e disparar o load job.

### 4.3 NDJSON e o "data lake" bruto
**NDJSON** (*newline-delimited JSON*) é um JSON por linha. É o formato nativo de carga do BigQuery e fácil de inspecionar.
**No projeto:** cada execução grava em pastas particionadas por data (`dt=AAAA-MM-DD`). Esse histórico permite recarregar a Bronze sem chamar a API de novo.

### 4.4 Docker e Docker Compose
- **Docker** empacota cada serviço com suas dependências num container isolado.
- **Docker Compose** descreve vários containers, suas redes e volumes num único arquivo (`docker-compose.yaml`) e sobe tudo com um comando.

**No projeto:**

| Serviço | Papel | Memória máxima |
|---|---|---|
| `postgres` | Banco de metadados do Airflow | 512 MB |
| `airflow-init` | Migra o banco e sai | – |
| `airflow-apiserver` | Interface web e API do Airflow, em `127.0.0.1:8080` | 1 GB |
| `airflow-scheduler` | Agenda e executa as tasks (LocalExecutor) | 1,5 GB |
| `airflow-dag-processor` | Lê e valida os arquivos de DAG | 768 MB |
| `dashboard` | Evidence, em `127.0.0.1:3000` | 512 MB |

O arquivo `docker-compose.vps.yaml` vale só na VPS. Ele liga o dashboard à rede `cadencia`, onde está o Caddy, e é ativado por `COMPOSE_FILE` no `.env`.

### 4.5 Apache Airflow 3 (orquestração)
Ferramenta de orquestração: define fluxos de trabalho como código (DAGs, grafos de tarefas), agenda, executa, tenta de novo em caso de falha, registra logs e mostra tudo numa interface web.
**No projeto:**
- **Versão:** imagem `apache/airflow:3.0.6`, com **LocalExecutor**: as tasks rodam como processos no próprio scheduler, sem Celery nem Redis, o que basta para uma VPS.
- **DAG:** `airflow/dags/indicadores_br.py`, com a TaskFlow API (`@dag`, `@task`) e `BashOperator` para o dbt.
- **Segurança:**
  - a interface fica presa em `127.0.0.1:8080` e o acesso é por túnel SSH (`ssh -L 8080:127.0.0.1:8080 root@VPS`);
  - os containers rodam como o uid 50000, não como root;
  - a DAG é criada pausada (`DAGS_ARE_PAUSED_AT_CREATION`).

### 4.6 PostgreSQL
Banco relacional usado pelo Airflow para guardar estado: execuções, tasks, conexões e histórico. Não guarda dados do negócio.
**No projeto:** Postgres 16 num volume Docker (`pgdata`). O script `scripts/backup-airflow-db.sh` faz um dump comprimido com retenção de 7 dias.

### 4.7 Google BigQuery (warehouse)
Data warehouse serverless do Google: SQL sobre dados colunares, sem servidor para administrar, cobrado por bytes lidos.
**No projeto, no modo sandbox** (projeto GCP sem conta de faturamento, custo zero), com estas limitações e respostas a elas:

| Limitação do sandbox | Como o projeto lida |
|---|---|
| Tabelas expiram em 60 dias | O dbt reconstrói Silver e Gold todo dia, e a Bronze é recarregada todo dia |
| Sem DML (`INSERT`, `UPDATE`, `MERGE`) | A Bronze entra por *load job* (`WRITE_TRUNCATE`), e o dbt usa só `view` e `table`, sem modelos incrementais |
| 10 GB de armazenamento e 1 TB de consulta por mês | O volume é de poucos MB. Há tetos de proteção: `maximum_bytes_billed` de 1 GB no dbt e cotas diárias de 10 GiB por conta e 30 GiB no projeto |

### 4.8 dbt (data build tool): transformação e qualidade
O dbt transforma dados dentro do warehouse usando SQL com Jinja (templates). Ele:
- resolve dependências entre modelos (`ref`, `source`);
- cria views e tabelas;
- roda testes de qualidade;
- gera documentação e linhagem.

**No projeto** (`dbt/`, dbt-core 1.12.6 com dbt-bigquery 1.9.2, instalado num venv separado dentro da imagem do Airflow para não conflitar com as dependências dele):
- **`sources.yml`:** declara a Bronze como fonte, com freshness.
- **`seeds/series_sgs.csv`:** catálogo das séries (código, nome, unidade, periodicidade), carregado como tabela.
- **`stg_sgs__observacoes` (Silver):**
  - converte o valor de texto (`"0,56"`) para número;
  - remove duplicatas com `qualify row_number()`, mantendo a ingestão mais recente;
  - junta com o catálogo das séries.
- **`fct_indicadores_mensais` (Gold):**
  - agrega por mês: média da Selic, média do dólar, IPCA e IGP-M do mês;
  - calcula o **IPCA acumulado em 12 meses** com produto composto: `exp(sum(ln(1 + x/100)))`, numa janela de 12 linhas;
  - só preenche o acumulado quando a janela está completa.
- **Testes:**
  - genéricos: `not_null`, `unique`, `relationships`, `accepted_values`;
  - singulares: sem duplicidade de série e data na Silver, e IPCA mensal dentro de [-5%, 10%];
  - freshness da fonte.
- **`macros/generate_schema_name.sql`:** faz cada modelo cair no dataset da sua camada (`silver` ou `gold`) em vez de usar prefixos.

### 4.9 Terraform (infraestrutura como código)
Descreve a infraestrutura em arquivos `.tf`. O `terraform plan` mostra o que vai mudar e o `terraform apply` aplica. O *state* (`terraform.tfstate`) guarda o que já existe.
**No projeto** (`terraform/`, providers `google` e `google-beta` ~> 6):
- **APIs:** habilita `bigquery`, `iam` e `serviceusage`.
- **Datasets:** `bronze`, `silver` e `gold`, com a expiração de 60 dias declarada para o plan não mostrar diferenças.
- **Conta do pipeline:** `indicadores-br-pipeline`, com `bigquery.jobUser` no projeto e `dataEditor` só nos três datasets.
- **Conta do dashboard:** `indicadores-br-dashboard`, com `bigquery.jobUser` e `dataViewer` **só na Gold**.
- **Cotas de consulta:** limite diário de 10 GiB por conta e 30 GiB no projeto.
- **State local:** guardar o state num bucket do GCS exigiria faturamento.

**Autenticação:** `scripts/gcp-token.sh` gera um token temporário a partir da configuração gcloud `pessoal`. Antes, ele confere que essa configuração tem conta logada e aponta para o mesmo projeto do `terraform.tfvars`. Assim o Terraform nunca usa por engano a credencial global da máquina (a conta de trabalho).

### 4.10 Google Cloud IAM e service accounts
**IAM** controla quem pode fazer o quê no GCP. **Service accounts** são identidades para programas, não para pessoas.
**No projeto:** uma conta por função, seguindo o *least privilege* (menor privilégio).
- **Pipeline:** escreve só nos datasets dele.
- **Dashboard:** só lê a Gold.

As chaves JSON ficam em `secrets/` (fora do Git) e são geradas por `scripts/criar-chave-sa.sh [pipeline|dashboard]`. Elas ficam fora do state do Terraform de propósito.

### 4.11 Evidence (dashboard como código)
Ferramenta de BI em que cada página é um arquivo **Markdown** com blocos de **SQL** e componentes de gráfico (`{% line_chart %}`, `{% big_value %}`, `{% table %}`). Os relatórios ficam versionados no Git e são revisados como código, sem arrastar e soltar.
**No projeto** (`dashboard/`, imagem oficial `evidencedev/serve:0.12.1`):
- **`connection.yaml`:** conector direto no BigQuery. A credencial vem de `GOOGLE_APPLICATION_CREDENTIALS` (ADC), então o arquivo não guarda segredo.
- **`pages/home.md`:**
  - cinco cartões: Selic, IPCA em 12 meses, juro real aproximado, IGP-M e dólar;
  - Selic contra IPCA em 12 meses, com a faixa da meta de inflação do CMN em cada ano;
  - juro real ao longo do tempo;
  - IPCA contra IGP-M mensais;
  - dólar;
  - tabela dos últimos 24 meses.
- **`theme.yaml`:** paleta de cores validada para daltonismo e contraste nos temas claro e escuro.
- **Funcionamento:** o `evidence serve` é um servidor que consulta o BigQuery ao vivo. Ele só relê as páginas quando reinicia (`docker compose restart dashboard`).
- **Acesso público por decisão:** é portfólio. Sem senha, o endpoint `/api/query` aceita SQL livre com a conta do dashboard. O risco é contido de três formas: a conta só lê a Gold, o projeto não tem faturamento e as cotas diárias impedem esgotar o 1 TB grátis do mês.

### 4.12 Caddy, HTTPS e sslip.io
- **Caddy** é um servidor web e proxy reverso que obtém e renova certificados HTTPS (Let's Encrypt) sozinho.
- **sslip.io** é um DNS curinga: `qualquer-coisa.173-212-242-68.sslip.io` aponta para o IP `173.212.242.68`, então não é preciso criar registro de DNS.

**No projeto:** o Caddy pertence a outro projeto da mesma VPS (cadencia) e atende vários sites. Foi adicionado um bloco que encaminha `indicadores.173-212-242-68.sslip.io` para o container `indicadores-dashboard:3000`, pela rede Docker `cadencia`. O bloco está em `~/projetos/cadencia/deploy/Caddyfile`, no commit `52eb598` do cadencia.

### 4.13 GitHub Actions (CI)
Executa verificações automáticas a cada push e pull request (`.github/workflows/ci.yml`):

| Job | O que verifica |
|---|---|
| `python` | `ruff` (lint) e `pytest` (testes do extrator) |
| `shell` | `shellcheck` em todos os scripts |
| `terraform` | `terraform fmt -check`, `init` e `validate` |
| `dbt` | `dbt parse` (o projeto compila, sem conectar ao BigQuery) |

### 4.14 Shell scripts (operação da VPS)
| Script | Função |
|---|---|
| `bootstrap-vps.sh` | Checa o Docker, cria pastas, gera o `.env` com senhas aleatórias e acerta o dono de cada pasta e chave (uid 50000 para o Airflow, 10001 para o Evidence) |
| `deploy.sh` | `git pull`, build e `up -d` |
| `backup-airflow-db.sh` | Dump do Postgres com retenção |
| `healthcheck.sh` | Consulta a saúde do Airflow; sai com código ≠ 0 se algo falhar (feito para cron) |
| `criar-chave-sa.sh` | Gera a chave JSON de uma service account |
| `gcp-token.sh` | Token temporário da configuração gcloud `pessoal`, com checagens |

### 4.15 Make
O `Makefile` dá atalhos: `make up`, `make test`, `make lint`, `make dbt-build`, `make tf-plan` e `make tf-apply`. Os comandos de Terraform passam sempre pelo `gcp-token.sh`.

### 4.16 gh (GitHub CLI)
Linha de comando do GitHub, para ver execuções de CI, PRs e issues pelo terminal. Foi instalado em `~/.local/bin/gh` (binário oficial com checksum conferido) e está logado na conta Hollx.

---

## 5. Modelo de dados

**`bronze.sgs_observacoes`**
| Coluna | Tipo | Descrição |
|---|---|---|
| serie_id | INTEGER | Código SGS |
| data_referencia | DATE | Data da observação |
| valor_texto | STRING | Valor como veio da API (`"0,56"`) |
| ingerido_em | TIMESTAMP | Momento da extração |

**`silver.stg_sgs__observacoes`** (view): `serie_id`, `nome_serie`, `unidade`, `periodicidade`, `data_referencia`, `valor` (NUMERIC) e `ingerido_em`. Tem uma linha por série e data.

**`gold.fct_indicadores_mensais`**
| Coluna | Descrição |
|---|---|
| mes | Primeiro dia do mês (chave única) |
| selic_meta_media | Média da meta Selic no mês (% a.a.) |
| dolar_compra_medio | Média do dólar no mês (R$) |
| ipca_mensal | IPCA do mês (%) |
| igpm_mensal | IGP-M do mês (%) |
| ipca_acumulado_12m | IPCA composto dos últimos 12 meses (%), nulo se a janela está incompleta |

---

## 6. Segurança e custo

- **Custo zero:** BigQuery sandbox, API pública, ferramentas open source, CI gratuito em repositório público e VPS já existente.
- **Sem segredo no Git:**
  - `.env`, `secrets/`, `terraform.tfvars` e `*.tfstate` estão no `.gitignore`;
  - o `connection.yaml` do Evidence usa variáveis de ambiente.
- **Least privilege:** cada service account só tem o acesso de que precisa.
- **Superfície exposta:**
  - o Airflow e o Postgres não ficam expostos à internet;
  - só o dashboard é público, via HTTPS.
- **Proteção de cota:**
  - `maximum_bytes_billed` de 1 GB por consulta no dbt;
  - cotas diárias do BigQuery: 10 GiB por conta e 30 GiB no projeto.
- **Containers sem root:** o Airflow roda como uid 50000 e o Evidence como uid 10001.

---

## 7. Histórico do que foi feito

### Base do projeto (05/11/2026)
- **`15f3667`:** pipeline completo, com Airflow 3, dbt, Terraform, BigQuery sandbox, scripts e CI.
- **`733495b`:** o bootstrap deixou de rodar o Airflow como root quando o próprio script roda como root.
- **Infraestrutura no GCP:** criada com Terraform. O primeiro `dbt build` local passou, com 3 modelos e 15 testes.
- **VPS:** pipeline publicado em `/opt/indicadores-br`.

### Sessão de 06/11/2026

**1. Diagnóstico: as execuções da DAG falhavam.**
As duas execuções de 05/11 (a agendada e a manual) falharam na task `dbt_source_freshness`, embora a extração e a carga tivessem funcionado.
- **Causa:** o código montado no container (`./dbt`) pertence ao root na VPS, e o Airflow roda como uid 50000. O dbt não conseguia criar as pastas `dbt/logs` e `dbt/target` e saía com código 2 sem nenhuma mensagem.
- **Correção (`b19ade9`):** as variáveis `DBT_LOG_PATH=/opt/airflow/logs/dbt` e `DBT_TARGET_PATH=/tmp/dbt-target` mandam esses arquivos para pastas graváveis.
- **Verificação:** uma execução manual completa passou em todas as tasks.

**2. Instalação do `gh`.**
Binário oficial em `~/.local/bin`, sem sudo e com checksum conferido. Login na conta Hollx. O CI de todos os commits está verde.

**3. Escolha da ferramenta de dashboard.**
A ideia inicial era o Looker Studio. Para manter o dashboard editável como código, foi escolhido o Evidence. A versão atual dele não gera mais site estático, então o GitHub Pages ficou de fora. A decisão foi rodar o `evidence serve` em Docker na própria VPS, atrás do Caddy.

**4. Dashboard (`bc6004e`).**
- service account `indicadores-br-dashboard` via Terraform;
- projeto `dashboard/`;
- serviço no Compose;
- `docker-compose.vps.yaml`;
- bloco no Caddy, aplicado com `caddy reload`, sem derrubar os outros sites.

**5. Visual e proteção de cota (`3c0c7cb`).**
- **Visual:**
  - título da página e cartão de juro real;
  - mês de referência de cada indicador;
  - faixa da meta de inflação;
  - gráfico de juro real;
  - linha do zero na inflação mensal;
  - unidades nos eixos;
  - paleta validada para daltonismo;
  - tabela com títulos legíveis e duas casas decimais.
- **Cotas:** limites diários de consulta no BigQuery, aplicados.

**6. Caddy no repo cadencia (`52eb598`, sem push).**
O commit leva só o bloco do dashboard. As mudanças da Chagas nos mesmos arquivos continuam sem commit.

**7. Decisões do usuário.**
- O dashboard fica **público**, por ser portfólio.
- O **cron** de backup e healthcheck foi dispensado, porque o projeto vai sair desta VPS em breve.

---

## 8. Operação do dia a dia

| Tarefa | Comando |
|---|---|
| Ver a interface do Airflow | `ssh -L 8080:127.0.0.1:8080 root@173.212.242.68` e abrir http://localhost:8080 |
| Disparar a DAG à mão | na VPS: `docker compose exec airflow-scheduler airflow dags trigger indicadores_br` |
| Atualizar o código na VPS | `cd /opt/indicadores-br && git pull && docker compose up -d` |
| Atualizar o dashboard | editar `dashboard/pages/*.md`, commit, push; na VPS: `git pull && docker compose restart dashboard` |
| Validar páginas do Evidence | na VPS: `docker exec -e HOME=/tmp -w /project indicadores-dashboard evidence validate` |
| Rodar SQL pelo Evidence | `docker exec -e HOME=/tmp -w /project indicadores-dashboard evidence query "select ..."` |
| Mudar infraestrutura | editar `terraform/`, `make tf-plan`, depois `make tf-apply` |
| Testes e lint locais | `make test` e `make lint` |
| Ver CI | `gh run list -R Hollx/indicadores-br` |

---

## 9. Checklist para tirar o projeto da VPS

1. **Caddy:** remover o bloco `{$INDICADORES_HOST}` do `deploy/Caddyfile` do cadencia e a variável `INDICADORES_HOST` do `compose.vps.yml`.
   - Gravar o arquivo na VPS com `cat >` (mantém o inode do arquivo montado) e rodar `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.
   - **Não** recriar o container `caddy`: ele atende os outros sites.
2. **Containers e volume:** `cd /opt/indicadores-br && docker compose down -v` remove os containers, o volume do Postgres e a rede `indicadores-br_default`. A rede `cadencia` não é afetada.
3. **Arquivos:** apagar `/opt/indicadores-br`. O `data/raw/` não precisa ser guardado, porque a API do BC fornece o histórico de novo.
4. **Chaves:** revogar no GCP as chaves das contas `indicadores-br-pipeline` e `indicadores-br-dashboard`, se o projeto não for reaproveitado em outro lugar. Para desmontar toda a infraestrutura do GCP, use `make tf-destroy`.
5. **Repositório:** atualizar o README dizendo onde o projeto passou a rodar, ou que ficou só como código de portfólio.

---

## 10. Glossário

- **DAG:** grafo acíclico dirigido; no Airflow, o fluxo de tarefas e suas dependências.
- **Task / dynamic task mapping:** unidade de trabalho de uma DAG. O `expand` cria várias tasks iguais a partir de uma lista.
- **LocalExecutor:** modo do Airflow em que as tasks rodam como processos locais do scheduler.
- **Load job:** carga de arquivos no BigQuery. É gratuita, diferente das consultas.
- **WRITE_TRUNCATE:** modo de carga que substitui a tabela inteira; deixa a carga idempotente.
- **Idempotência:** rodar de novo produz o mesmo resultado, sem duplicar dados.
- **Seed (dbt):** CSV versionado que o dbt carrega como tabela.
- **Freshness:** teste de quão recente é o dado de uma fonte.
- **Least privilege:** dar a cada identidade só as permissões necessárias.
- **ADC (Application Default Credentials):** forma padrão do Google de achar credenciais, por exemplo pela variável `GOOGLE_APPLICATION_CREDENTIALS`.
- **Proxy reverso:** servidor que recebe as requisições da internet e as repassa a serviços internos.
- **Juro real aproximado:** Selic meta menos a inflação dos últimos 12 meses (aproximação *ex post*).
- **Meta de inflação (CMN):** alvo do IPCA definido pelo Conselho Monetário Nacional. Foi 3,5% em 2022, 3,25% em 2023 e 3% desde 2024, sempre com tolerância de ±1,5 ponto percentual.
