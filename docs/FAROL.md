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

Testes: `cd farol/api && .venv/bin/pytest -q` · build do front: `cd farol/web && npm run build`.

## Andamento

- [x] Governança no dbt (dono, camada, tags, colunas documentadas, exposure)
- [x] API e telas de governança, catálogo e linhagem
- [x] Fonte nova: expectativas de mercado (Boletim Focus)
- [ ] Qualidade (testes, frescor e histórico)
- [ ] Monitoramento (execuções do Airflow)
- [ ] Painel de etapas
- [ ] Visualização com gráficos próprios
- [ ] Deploy na VPS

## Regras do projeto

- Código escrito do zero. Nenhum arquivo, trecho, nome ou texto vem de projetos de trabalho.
- Só dados públicos (APIs SGS e Olinda do Banco Central).
- Somente leitura em relação ao pipeline.
