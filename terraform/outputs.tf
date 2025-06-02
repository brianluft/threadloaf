output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.api.id
}

output "elastic_ip" {
  description = "Elastic IP address of the API server"
  value       = aws_eip.api.public_ip
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "subnet_id" {
  description = "ID of the subnet"
  value       = aws_subnet.main.id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.api.id
}

output "iam_role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.ec2_role.arn
}

output "env_parameter_name" {
  description = "Parameter Store parameter name for .env file"
  value       = aws_ssm_parameter.env_file.name
}

output "release_url_parameter_name" {
  description = "Parameter Store parameter name for release URL"
  value       = aws_ssm_parameter.release_url.name
}

output "api_url" {
  description = "API server URL (HTTP)"
  value       = "http://${aws_eip.api.public_ip}"
}

output "session_manager_command" {
  description = "AWS CLI command to connect via Session Manager"
  value       = "aws ssm start-session --target ${aws_instance.api.id}"
} 