output "service_account_email" {
  description = "Service account usada pelo Airflow e pelo dbt."
  value       = google_service_account.pipeline.email
}

output "datasets" {
  description = "Datasets criados, por camada."
  value       = { for camada, ds in google_bigquery_dataset.camadas : camada => ds.id }
}

output "dashboard_service_account_email" {
  description = "Service account do dashboard (Evidence), só leitura na Gold."
  value       = google_service_account.dashboard.email
}
