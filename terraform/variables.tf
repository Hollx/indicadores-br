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

variable "cota_query_conta_mib_dia" {
  description = "Teto de bytes consultados por conta por dia no BigQuery, em MiB (10 GiB)."
  type        = number
  default     = 10240
}

variable "cota_query_projeto_mib_dia" {
  description = "Teto de bytes consultados no projeto por dia no BigQuery, em MiB (30 GiB)."
  type        = number
  default     = 30720
}
