.PHONY: up down logs deploy backup health test lint dbt-build dbt-test tf-init tf-plan tf-apply tf-destroy

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
	ruff check airflow tests
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
