FROM apache/airflow:3.0.6

# A imagem oficial já inclui o provider google (google-cloud-bigquery) e requests.
# O dbt fica num venv separado para não conflitar com as dependências do Airflow.
RUN python -m venv /home/airflow/dbt-venv \
    && /home/airflow/dbt-venv/bin/pip install --no-cache-dir "dbt-core==1.12.6" "dbt-bigquery==1.9.2"
