variable "availability_zone" {
  description = "The availability zone to deploy resources in"
  type        = string
  default     = "us-east-2c"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t4g.micro"
}

variable "instance_name" {
  description = "Name tag for the EC2 instance"
  type        = string
  default     = "api.threadloaf.com"
}

variable "env_parameter_name" {
  description = "Parameter Store parameter name for .env file"
  type        = string
  default     = "/threadloaf/api/env"
}

variable "release_path_parameter_name" {
  description = "Parameter Store parameter name for API release path in S3"
  type        = string
  default     = "/threadloaf/api/release-path"
} 