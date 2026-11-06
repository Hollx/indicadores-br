locals {
  # No sandbox o BigQuery impõe 60 dias de expiração de tabelas e de partições.
  # Declarar os valores evita drift no plan.
  expiracao_sandbox_ms = 60 * 24 * 60 * 60 * 1000

  labels = {
    projeto        = "indicadores-br"
    gerenciado_por = "terraform"
  }
}

resource "google_project_service" "apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "iam.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

resource "google_bigquery_dataset" "camadas" {
  for_each = toset(var.camadas)

  dataset_id                      = each.key
  location                        = var.bq_location
  description                     = "Camada ${each.key} do pipeline indicadores-br"
  default_table_expiration_ms     = var.sandbox ? local.expiracao_sandbox_ms : null
  default_partition_expiration_ms = var.sandbox ? local.expiracao_sandbox_ms : null
  delete_contents_on_destroy      = true

  labels = merge(local.labels, { camada = each.key })

  depends_on = [google_project_service.apis]
}

resource "google_service_account" "pipeline" {
  account_id   = "indicadores-br-pipeline"
  display_name = "Pipeline indicadores-br (Airflow + dbt)"

  depends_on = [google_project_service.apis]
}

# Least privilege: rodar jobs no projeto e editar só os três datasets do pipeline.
resource "google_project_iam_member" "job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.pipeline.email}"
}

resource "google_bigquery_dataset_iam_member" "editor" {
  for_each = google_bigquery_dataset.camadas

  dataset_id = each.value.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.pipeline.email}"
}

# Dashboard (Evidence): só lê a Gold. Conta separada do pipeline para não herdar escrita.
resource "google_service_account" "dashboard" {
  account_id   = "indicadores-br-dashboard"
  display_name = "Dashboard indicadores-br (Evidence, só leitura na Gold)"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "dashboard_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.dashboard.email}"
}

resource "google_bigquery_dataset_iam_member" "dashboard_viewer" {
  dataset_id = google_bigquery_dataset.camadas["gold"].dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.dashboard.email}"
}
