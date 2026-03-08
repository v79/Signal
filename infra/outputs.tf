output "cloudfront_domain" {
  description = "Public URL of the CloudFront distribution (*.cloudfront.net)."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — needed for cache invalidation in CI."
  value       = aws_cloudfront_distribution.site.id
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket holding the site content."
  value       = aws_s3_bucket.site.id
}
