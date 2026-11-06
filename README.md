# indicadores-br

Pipeline de dados de ponta a ponta com indicadores econômicos públicos do Brasil (Selic, IPCA, IGP-M e dólar), construído com **custo zero**.

O objetivo é praticar e demonstrar, num repositório público, a stack moderna de engenharia de dados: **Airflow** para orquestração, **dbt** para transformação e testes de qualidade, **Terraform** para infraestrutura como código, **BigQuery** como warehouse em arquitetura **Medallion** (Bronze/Silver/Gold), **shell script** para operação da VPS e **GitHub Actions** para CI.

## Arquitetura

```
API SGS do Banco Central (sem chave, sem custo)
        │
        ▼  Airflow 3 (Docker Compose na VPS), execução diária
  data/raw/ (NDJSON particionado por data, histórico na VPS)
        │  load job (gratuito)
        ▼
  BigQuery  bronze.sgs_observacoes
        │  dbt (views)
        ▼
  BigQuery  silver.stg_sgs__observacoes  +  silver.series_sgs (seed)
        │  dbt (tabelas)
        ▼
  BigQuery  gold.fct_indicadores_mensais  ──▶  Evidence (dashboard em código, na VPS)

Terraform: datasets bronze/silver/gold, service accounts e IAM mínimo
GitHub Actions: lint e testes Python, shellcheck, terraform validate, dbt parse
Shell: bootstrap da VPS, deploy, backup do banco do Airflow, healthcheck
```

## Stack e custo

| Peça | Ferramenta | Custo |
|---|---|---|
| Fonte | API SGS do Banco Central | Grátis |
| Orquestração | Apache Airflow 3 (LocalExecutor) em Docker Compose | Grátis (VPS própria) |
| Data lake bruto | Arquivos NDJSON na VPS (`data/raw/`) | Grátis |
| Warehouse | BigQuery **sandbox** (sem cartão de crédito) | Grátis |
| Transformação e qualidade | dbt Core + dbt-bigquery | Grátis |
| Infraestrutura | Terraform (provider google) | Grátis |
| CI | GitHub Actions (repositório público) | Grátis |
| Visualização | Evidence (`evidence serve` em Docker, páginas em Markdown + SQL) | Grátis (VPS própria) |

### Limites do BigQuery sandbox (e como o projeto lida com eles)

- **Tabelas expiram em 60 dias.** O dbt reconstrói Silver e Gold a cada execução, e o histórico bruto fica salvo em `data/raw/` na VPS, então a Bronze pode ser recarregada a qualquer momento.
- **Sem DML (`INSERT`, `UPDATE`, `MERGE`).** Por isso a Bronze é carregada com load job em modo `WRITE_TRUNCATE`, e o dbt usa só materializações `view` e `table`, sem modelos incrementais.
- **Cota gratuita:** 10 GB de armazenamento e 1 TB de consulta por mês. O volume deste projeto fica em poucos MB. O `profiles.yml` ainda define `maximum_bytes_billed` como proteção.

## Como rodar

### 1. GCP (uma vez)

1. Crie um projeto no [console do GCP](https://console.cloud.google.com/), logado com a conta que vai ser dona do portfólio, **sem** conta de faturamento. O BigQuery entra em modo sandbox.
2. Crie uma configuração gcloud só para este projeto. Ela não interfere nas outras contas da máquina:

   ```bash
   gcloud config configurations create pessoal
   gcloud auth login                          # escolha a conta do portfólio no navegador
   gcloud config set project SEU-PROJETO
   gcloud config configurations activate default   # volta para a configuração anterior, se quiser
   ```

3. Provisione a infraestrutura:

   ```bash
   cp terraform/terraform.tfvars.example terraform/terraform.tfvars   # preencha project_id
   make tf-init tf-plan tf-apply
   ./scripts/criar-chave-sa.sh             # gera secrets/sa.json para o Airflow
   ./scripts/criar-chave-sa.sh dashboard   # gera secrets/sa-dashboard.json para o Evidence
   ```

Os comandos `make tf-*` e o `criar-chave-sa.sh` sempre usam a configuração `pessoal` (troque com `GCLOUD_CONFIG=outra`), qualquer que seja a configuração ativa. Antes de rodar, `scripts/gcp-token.sh` confere que ela tem conta logada e aponta para o mesmo `project_id` do `terraform.tfvars`; se não, para com erro. O Terraform recebe só um token temporário (`GOOGLE_OAUTH_ACCESS_TOKEN`), então **não use** `gcloud auth application-default login`: essa credencial é global da máquina e não segue a configuração.

### 2. VPS

```bash
./scripts/bootstrap-vps.sh      # checa o Docker, cria pastas e gera o .env com senhas aleatórias
# edite .env: GCP_PROJECT_ID
# copie secrets/sa.json e secrets/sa-dashboard.json para a VPS (scp), com permissão 600,
# e rode o bootstrap de novo para acertar o dono de cada chave
make up
```

A interface do Airflow fica presa em `127.0.0.1:8080`, de propósito. Para acessá-la a partir da sua máquina, use um túnel SSH:

```bash
ssh -L 8080:127.0.0.1:8080 usuario@sua-vps
# abra http://localhost:8080
```

O dashboard (Evidence) fica em `127.0.0.1:3000` pelo mesmo túnel. Na VPS do autor ele é publicado com HTTPS pelo Caddy que já atende os outros serviços da máquina: `COMPOSE_FILE=docker-compose.yaml:docker-compose.vps.yaml` no `.env` liga o container à rede desse Caddy.

Como a porta só existe dentro da VPS, o Airflow roda com o gerenciador de autenticação simples e todos os usuários como admin. **Não** exponha a porta 8080 publicamente sem antes configurar autenticação.

### 3. Operação

| Comando | O que faz |
|---|---|
| `make deploy` | `git pull`, build da imagem e `up -d` |
| `make backup` | Dump do banco do Airflow com retenção de 7 dias |
| `make health` | Checa a saúde do Airflow (código de saída ≠ 0 se falhar, bom para cron) |
| `make test` | Testes unitários do extrator |
| `make dbt-build` | `dbt build` dentro do container |

Sugestão de cron na VPS:

```cron
0 3 * * * cd /opt/indicadores-br && ./scripts/backup-airflow-db.sh >> backups/backup.log 2>&1
*/15 * * * * cd /opt/indicadores-br && ./scripts/healthcheck.sh >> logs/health.log 2>&1
```

## Estrutura

```
airflow/          Dockerfile, DAG e código de extração/carga (testável sem Airflow)
dashboard/        projeto Evidence: páginas em Markdown + SQL e conexão com o BigQuery
dbt/              projeto dbt: sources, modelos silver/gold, seed, testes
terraform/        datasets, service account e IAM no GCP
scripts/          shell scripts de operação da VPS
tests/            testes unitários (pytest)
.github/workflows CI
```

## Decisões de projeto

- **Extração idempotente:** cada execução baixa uma janela fixa de histórico (`SGS_ANOS_HISTORICO`) e substitui a Bronze. Reexecutar um dia não duplica dados.
- **Deduplicação na Silver:** `qualify row_number()` mantém a observação mais recente por série e data.
- **Qualidade de dados no dbt:** testes `not_null`, `unique`, `relationships`, `accepted_values`, freshness da fonte e testes singulares (duplicidade, faixa plausível do IPCA).
- **dbt num venv separado** dentro da imagem do Airflow, para não conflitar com as dependências do Airflow.
- **Least privilege:** a service account do pipeline só tem `bigquery.jobUser` no projeto e `dataEditor` nos três datasets. A do dashboard tem `jobUser` e `dataViewer` só na Gold.
- **Dashboard como código:** as páginas do Evidence (`dashboard/pages/*.md`) são Markdown com SQL do BigQuery, versionadas e revisadas como o resto do código. O `connection.yaml` não guarda segredo: a credencial vem de `GOOGLE_APPLICATION_CREDENTIALS`.
- **Arquivos do dbt fora do checkout:** `logs` e `target` vão para pastas graváveis pelo container (`DBT_LOG_PATH`, `DBT_TARGET_PATH`), porque o código montado na VPS é do root e o Airflow roda sem root.

## Próximos passos

- [x] Dashboard em código (Evidence) sobre `gold.fct_indicadores_mensais`
- [ ] Mais fontes (IBGE SIDRA)
- [ ] Fase 2a: PySpark local refazendo a Silver a partir de `data/raw/` (Parquet carregado no BigQuery), com teste de reconciliação contra o dbt no CI
- [ ] Fase 2b: Databricks Free Edition como lakehouse paralelo (NDJSON enviado para um Volume, mesmo código PySpark gerando tabelas Delta, deploy por Asset Bundles, disparo pelo Airflow). A Free Edition só tem saída de rede para domínios confiáveis, então o Databricks não chama a API do BC nem o BigQuery
- [ ] Tirar o projeto da VPS atual (checklist em `docs/GUIA-DO-PROJETO.md`)

Guia completo do projeto (ferramentas, arquitetura, histórico): [`docs/GUIA-DO-PROJETO.md`](docs/GUIA-DO-PROJETO.md)
