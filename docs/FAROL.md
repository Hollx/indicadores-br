# Farol: monitoramento, governança, qualidade e visualização

O **Farol** é a aplicação web do `indicadores-br`. Num só lugar, ela mostra:

| Pilar | O que a pessoa vê | De onde vem |
|---|---|---|
| Monitoramento | Execuções do pipeline (status, duração, tentativas por etapa) e alertas | API REST do Airflow 3 |
| Governança | Catálogo (dono, camada, descrição, colunas), linhagem de ponta a ponta e cobertura de documentação e testes | `manifest.json` do dbt |
| Qualidade | Resultado de cada teste dbt, histórico entre execuções e frescor das fontes | `run_results.json` e `sources.json` do dbt, histórico em SQLite |
| Painel de etapas | Extração → Bronze → Frescor → Silver → Gold → Visualização, com o status atual de cada etapa | Composição dos pilares acima |
| Visualização | Indicadores econômicos e expectativa x realizado, em gráficos próprios | Camada Gold no BigQuery |

## Arquitetura

```
Airflow (API REST) ─────┐
artefatos do dbt ───────┼──▶  farol/api (FastAPI)  ──▶  farol/web (React + TypeScript)
BigQuery (camada Gold) ─┘        └─ SQLite: histórico de testes e execuções
```

- **api:** FastAPI. Lê os artefatos do dbt de uma pasta montada, consulta a API do Airflow e a
  camada Gold do BigQuery (com cache e teto de bytes por consulta). Guarda o histórico de cada
  execução do dbt no SQLite, porque o dbt sobrescreve `run_results.json` a cada rodada.
- **web:** React + Vite + TypeScript. Os gráficos são componentes SVG próprios, sem biblioteca de
  gráficos. A linhagem usa React Flow.
- **Somente leitura:** o Farol observa o pipeline, nunca dispara nem altera execuções.

## Como rodar localmente

```bash
# API: lê os artefatos do dbt (rode `dbt parse` ou `dbt build` antes)
cd farol/api
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
DBT_ARTEFATOS_DIR=../../dbt/target .venv/bin/uvicorn farol_api.main:app --port 8010

# Web (outro terminal): http://localhost:5173
cd farol/web
npm ci && npm run dev
```

Variáveis opcionais da API:

| Variável | Para quê |
|---|---|
| `DBT_ARTEFATOS_DIR` | Pasta com `manifest.json`, `run_results.json` e `sources.json` |
| `FAROL_DB` | Arquivo SQLite do histórico (padrão `farol.db`) |
| `AIRFLOW_URL`, `AIRFLOW_USUARIO`, `AIRFLOW_SENHA` | API do Airflow; sem `AIRFLOW_URL` o monitoramento aparece como indisponível |
| `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Leitura da camada Gold; sem elas a visualização aparece como indisponível |

## Deploy (VPS)

`docker-compose.yaml` sobe `farol-api` (FastAPI, uid 10001) e `farol-web` (nginx com o build do
front, publicado em `127.0.0.1:3010`). O Airflow grava os artefatos do dbt em `./dbt-artefatos`,
montado só leitura na API. Na VPS, `docker-compose.vps.yaml` liga o `farol-web` à rede do Caddy
(container `indicadores-farol`), publicado em https://farol.173-212-242-68.sslip.io.

O nginx só deixa passar `GET` em `/api/`. A consulta à Gold tem cache de 10 minutos e teto de 100 MB
por consulta; o Airflow é lido com o token do modo "todos admin" (`GET /auth/token`), por dentro da
rede Docker, sem expor a porta 8080.

Testes: `cd farol/api && .venv/bin/pytest -q` · build do front: `cd farol/web && npm run build`.

## Andamento

- [x] Governança no dbt (dono, camada, tags, colunas documentadas, exposure)
- [x] API e telas de governança, catálogo e linhagem
- [x] Fonte nova: expectativas de mercado (Boletim Focus)
- [x] Qualidade (testes, frescor e histórico)
- [x] Monitoramento (execuções do Airflow)
- [x] Painel de etapas
- [x] Visualização com gráficos próprios
- [ ] Deploy na VPS

## CI/CD

Cada push na `main` roda o CI no GitHub Actions (testes do pipeline, do Spark e da API do Farol,
build do front, shellcheck, Terraform e dbt). Com tudo verde, o job `deploy` atualiza a VPS:

1. O runner se conecta por SSH com uma chave só de deploy, guardada nos *secrets* do repositório.
2. Na VPS, essa chave tem `restrict` e `command=` no `authorized_keys`: não abre shell, só executa
   `scripts/deploy-ci.sh`, que recebe o SHA do commit e o valida.
3. O script busca a `main`, reconstrói as imagens, sobe os serviços e espera o Airflow e o Farol
   responderem. Um lock impede dois deploys ao mesmo tempo.
4. O workflow confirma que o Farol responde pela internet e registra o deploy no ambiente `producao`.

## Regras do projeto

- Código escrito do zero. Nenhum arquivo, trecho, nome ou texto vem de projetos de trabalho.
- Só dados públicos (APIs SGS e Olinda do Banco Central).
- Somente leitura em relação ao pipeline.
