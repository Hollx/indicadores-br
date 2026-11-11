.PHONY: up down logs deploy backup health test lint dbt-build dbt-test tf-init tf-plan tf-apply tf-destroy \
	spark-venv spark-raw-sync spark-raw-local spark-run spark-test spark-reconcile \
	databricks-upload databricks-deploy databricks-run

GCLOUD_CONFIG ?= pessoal
COMPOSE := docker compose
DBT := $(COMPOSE) exec airflow-scheduler bash -c 'cd $$DBT_PROJECT_DIR && /home/airflow/dbt-venv/bin/dbt

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

deploy:
	./scripts/deploy.sh

backup:
	./scripts/backup-airflow-db.sh

health:
	./scripts/healthcheck.sh

test:
	python3 -m pytest -q

lint:
	ruff check airflow tests spark
	shellcheck scripts/*.sh

dbt-build:
	$(DBT) build'

dbt-test:
	$(DBT) test'

# Terraform autentica com um token da configuração gcloud "pessoal" (troque com GCLOUD_CONFIG=...).
# Se o script de token falhar, o comando para: nunca cai na credencial global da máquina.
# init só baixa providers e não precisa de credencial.
tf-init:
	terraform -chdir=terraform init

tf-plan tf-apply tf-destroy:
	@token="$$(GCLOUD_CONFIG=$(GCLOUD_CONFIG) ./scripts/gcp-token.sh)" || exit 1; \
	GOOGLE_OAUTH_ACCESS_TOKEN="$$token" terraform -chdir=terraform $(subst tf-,,$@)

# ---- Fase 2: PySpark (local) e Databricks ----
# Venv separado: PySpark 4 precisa de Java 17+ e não entra na imagem do Airflow.
SPARK_PY := .venv-spark/bin/python
SPARK_ENV := PYTHONPATH=spark
VPS ?=
GCP_PROJECT_ID ?=

spark-venv:
	uv venv .venv-spark --python 3.12
	uv pip install -p .venv-spark -r spark/requirements.txt

# Copia a partição mais recente de data/raw/sgs da VPS (a mesma janela que está no BigQuery).
spark-raw-sync:
	@[ -n "$(VPS)" ] || { echo "defina VPS=usuario@host"; exit 1; }
	@ultima="$$(ssh $(VPS) 'ls -1 /opt/indicadores-br/data/raw/sgs | tail -1')"; \
	mkdir -p data/raw/sgs && rsync -a "$(VPS):/opt/indicadores-br/data/raw/sgs/$$ultima" data/raw/sgs/

# Alternativa sem VPS: baixa direto da API do BC (não reconcilia com o BigQuery).
spark-raw-local:
	$(SPARK_PY) spark/baixar_raw_local.py

spark-run:
	$(SPARK_ENV) $(SPARK_PY) -m indicadores_spark.job_local executar

spark-test:
	$(SPARK_ENV) $(SPARK_PY) -m pytest -q spark/tests

spark-reconcile:
	@[ -n "$(GCP_PROJECT_ID)" ] || { echo "defina GCP_PROJECT_ID=..."; exit 1; }
	GOOGLE_APPLICATION_CREDENTIALS=secrets/sa.json GCP_PROJECT_ID=$(GCP_PROJECT_ID) \
		$(SPARK_ENV) $(SPARK_PY) -m indicadores_spark.job_local reconciliar

databricks-upload:
	./scripts/enviar-raw-databricks.sh

databricks-deploy:
	databricks bundle validate && databricks bundle deploy

databricks-run:
	databricks bundle run indicadores_spark
