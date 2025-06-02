# Data sources
data "aws_ami" "ubuntu_arm64" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "threadloaf-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "threadloaf-igw"
  }
}

resource "aws_subnet" "main" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true

  tags = {
    Name = "threadloaf-subnet"
  }
}

resource "aws_route_table" "main" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "threadloaf-rt"
  }
}

resource "aws_route_table_association" "main" {
  subnet_id      = aws_subnet.main.id
  route_table_id = aws_route_table.main.id
}

# S3 Bucket for release files
resource "aws_s3_bucket" "files" {
  bucket = "threadloaf-files-prod"

  tags = {
    Name = "threadloaf-files-prod"
  }
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket = aws_s3_bucket.files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Parameter Store Parameters
resource "aws_ssm_parameter" "env_file" {
  name  = var.env_parameter_name
  type  = "SecureString"
  value = "placeholder" # Will be set manually in AWS Console

  tags = {
    Name = "threadloaf-env"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "release_path" {
  name  = var.release_path_parameter_name
  type  = "String"
  value = "placeholder" # Will be set manually in AWS Console

  tags = {
    Name = "threadloaf-release-path"
  }

  lifecycle {
    ignore_changes = [value]
  }
}

# IAM Role and Policies
resource "aws_iam_role" "ec2_role" {
  name = "threadloaf-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_policy" "parameter_store_read" {
  name        = "threadloaf-parameter-store-read"
  description = "Allow read-only access to Threadloaf Parameter Store parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          aws_ssm_parameter.env_file.arn,
          aws_ssm_parameter.release_path.arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "s3_bucket_read" {
  name        = "threadloaf-s3-bucket-read"
  description = "Allow read-only access to Threadloaf S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.files.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "parameter_store_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.parameter_store_read.arn
}

resource "aws_iam_role_policy_attachment" "s3_bucket_read" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.s3_bucket_read.arn
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "threadloaf-ec2-profile"
  role = aws_iam_role.ec2_role.name
}

# Security Group
resource "aws_security_group" "api" {
  name        = "threadloaf-api-sg"
  description = "Security group for Threadloaf API server"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "threadloaf-api-sg"
  }
}

# Elastic IP
resource "aws_eip" "api" {
  domain = "vpc"

  tags = {
    Name = "threadloaf-api-eip"
  }
}

# Cloud-init user data script
locals {
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    env_parameter_name          = var.env_parameter_name
    release_path_parameter_name = var.release_path_parameter_name
    region                      = "us-east-2"
    s3_bucket                   = aws_s3_bucket.files.bucket
  }))
}

# EC2 Instance
resource "aws_instance" "api" {
  ami                    = data.aws_ami.ubuntu_arm64.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.main.id
  vpc_security_group_ids = [aws_security_group.api.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  user_data_base64       = local.user_data

  tags = {
    Name = var.instance_name
  }
}

# Associate Elastic IP with EC2 instance
resource "aws_eip_association" "api" {
  instance_id   = aws_instance.api.id
  allocation_id = aws_eip.api.id
}

# CloudWatch Agent IAM Policy
resource "aws_iam_policy" "cloudwatch_agent" {
  name        = "threadloaf-cloudwatch-agent"
  description = "Allow CloudWatch Agent to send metrics and logs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "ec2:DescribeTags",
          "logs:PutLogEvents",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.cloudwatch_agent.arn
}

# SNS Topic for Alarms
resource "aws_sns_topic" "alerts" {
  name = "threadloaf-alerts"

  tags = {
    Name = "threadloaf-alerts"
  }
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "threadloaf@threadloaf.com"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "memory_usage" {
  alarm_name          = "threadloaf-memory-usage-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "mem_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "This metric monitors ec2 memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    InstanceId = aws_instance.api.id
  }

  tags = {
    Name = "threadloaf-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "disk_usage" {
  alarm_name          = "threadloaf-disk-usage-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "disk_used_percent"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "This metric monitors ec2 disk utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "breaching"

  dimensions = {
    InstanceId = aws_instance.api.id
    device     = "/dev/root"
    fstype     = "ext4"
    path       = "/"
  }

  tags = {
    Name = "threadloaf-disk-alarm"
  }
}

# IAM User for Manual Operations
resource "aws_iam_user" "manual_ops" {
  name = "threadloaf-manual-ops"

  tags = {
    Name = "threadloaf-manual-ops"
  }
}

# Policy for read/write access to terraform state bucket
resource "aws_iam_policy" "terraform_bucket_access" {
  name        = "threadloaf-terraform-bucket-access"
  description = "Allow read/write access to Threadloaf terraform state bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::threadloaf-terraform-prod",
          "arn:aws:s3:::threadloaf-terraform-prod/*"
        ]
      }
    ]
  })
}

# Policy for read/write access to files bucket
resource "aws_iam_policy" "files_bucket_access" {
  name        = "threadloaf-files-bucket-access"
  description = "Allow read/write access to Threadloaf files bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.files.arn,
          "${aws_s3_bucket.files.arn}/*"
        ]
      }
    ]
  })
}

# Attach policies to the manual ops user
resource "aws_iam_user_policy_attachment" "manual_ops_terraform_bucket" {
  user       = aws_iam_user.manual_ops.name
  policy_arn = aws_iam_policy.terraform_bucket_access.arn
}

resource "aws_iam_user_policy_attachment" "manual_ops_files_bucket" {
  user       = aws_iam_user.manual_ops.name
  policy_arn = aws_iam_policy.files_bucket_access.arn
} 