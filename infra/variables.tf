variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-2"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for the static site content."
  type        = string
}

variable "environment" {
  description = "Deployment environment label (used in resource tags)."
  type        = string
  default     = "production"
}
