variable "project_id" {
  description = "ID do projeto GCP (sem conta de faturamento = BigQuery sandbox)."
  type        = string
}

variable "region" {
  description = "Região padrão do provider."
  type        = string
  default     = "us-central1"
}

variable "bq_location" {
  description = "Localização dos datasets do BigQuery."
  type        = string
  default     = "US"
}

variable "sandbox" {
  description = "true quando o projeto não tem faturamento: o BigQuery força expiração de 60 dias nas tabelas."
  type        = bool
  default     = true
}

variable "camadas" {
  description = "Datasets da arquitetura Medallion."
  type        = list(string)
  default     = ["bronze", "silver", "gold"]
}
