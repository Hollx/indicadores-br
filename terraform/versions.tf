terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # State local (custo zero). Um backend GCS exigiria faturamento ativo.
}

provider "google" {
  project = var.project_id
  region  = var.region
}
