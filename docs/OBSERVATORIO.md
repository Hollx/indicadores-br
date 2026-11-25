# Observatório: governança, monitoramento e painel de etapas

Camada nova do `indicadores-br`: uma aplicação web que mostra **o estado do próprio pipeline**.
O que existe, de onde veio, se está saudável e se os dados estão em dia. O dashboard em Evidence
continua sendo o produto de dados (os indicadores). O Observatório é a visão de quem opera
esse produto.

## Objetivo

Mostrar num só lugar, com dados públicos e código escrito do zero:

| Pilar | O que a pessoa vê | De onde vem |
|---|---|---|
| Governança | Catálogo de tabelas (dono, descrição, camada, colunas documentadas), linhagem de ponta a ponta e cobertura de documentação e testes | `manifest.json` e `catalog.json` do dbt |
| Qualidade | Resultado de cada teste dbt, histórico de falhas e frescor das fontes | `run_results.json` e `sources.json` do dbt |
| Monitoramento | Execuções do Airflow (status, duração, tentativas) e alerta quando algo falha ou atrasa | API REST do Airflow 3 |
| Painel de etapas | O fluxo Extração → Bronze → Frescor → Silver → Gold → Dashboard, com o status atual de cada etapa | Composição dos três acima |
| Visualização | Link para o dashboard em Evidence, declarado como `exposure` no dbt | `exposures` do dbt |

## Arquitetura

```
Airflow (API REST)  ─┐
artefatos do dbt  ───┼──▶  observatorio/api (FastAPI)  ──▶  observatorio/web (React + Vite)
                     │        └─ SQLite: histórico de execuções e testes
Evidence (exposure) ─┘
```

- **api:** FastAPI em Python. Lê os artefatos do dbt de uma pasta montada e consulta a API do
  Airflow. Um coletor guarda um retrato a cada execução no SQLite, para mostrar histórico mesmo
  depois que o dbt sobrescreve `run_results.json`.
- **web:** React + Vite + TypeScript, com React Flow para a linhagem e ECharts para os gráficos.
  Só leitura: não dispara nem altera execuções.
- **Deploy:** dois serviços novos no `docker-compose.yaml`, publicados só em `127.0.0.1`, como o
  Airflow e o Evidence.

## Fases

1. **Governança no dbt.** Dono, tags e descrições em todas as camadas, colunas documentadas e o
   dashboard declarado como `exposure`. Sem isso o catálogo nasce vazio.
2. **API: catálogo e linhagem.** Endpoints que leem o `manifest.json`: modelos, colunas, cobertura
   e o grafo de linhagem. Testes com pytest sobre um manifest de exemplo.
3. **Web: Catálogo e Linhagem.** Primeira tela navegável.
4. **Qualidade e monitoramento.** Testes e frescor (dbt) + execuções (Airflow), com histórico no
   SQLite e alerta de falha.
5. **Painel de etapas.** A tela-resumo do pipeline.
6. **Deploy e documentação.** Docker Compose, CI (lint, testes, build do front), README e guia.

## Como rodar localmente

```bash
# API (lê os artefatos do dbt; rode `dbt parse` ou `dbt build` antes)
cd observatorio/api
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
DBT_ARTEFATOS_DIR=../../dbt/target .venv/bin/uvicorn observatorio_api.main:app --port 8010

# Web (outro terminal): http://localhost:5173
cd observatorio/web
npm ci && npm run dev
```

Testes: `cd observatorio/api && .venv/bin/pytest -q` · build do front: `npm run build`.

## Andamento

- [x] Fase 1: governança no dbt
- [x] Fase 2: API de catálogo, linhagem e cobertura
- [x] Fase 3: telas de Governança, Catálogo e Linhagem
- [ ] Fase 4: qualidade e monitoramento
- [ ] Fase 5: painel de etapas
- [ ] Fase 6: deploy, CI e documentação final

## Regras do projeto

- Código escrito do zero. Nenhum arquivo, trecho, nome ou texto vem de projetos de trabalho.
- Só dados públicos (APIs SGS e Olinda do Banco Central).
- Tudo somente leitura em relação ao pipeline: o Observatório observa, não executa.
