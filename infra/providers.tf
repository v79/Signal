terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  required_version = ">= 1.6"

  # Uncomment and configure to store state remotely.
  # The state bucket must be created separately before first apply.
  # backend "s3" {
  #   bucket         = "signal-tfstate"
  #   key            = "signal/production/terraform.tfstate"
  #   region         = "eu-west-2"
  #   dynamodb_table = "signal-tfstate-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
