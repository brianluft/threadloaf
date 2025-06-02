# Threadloaf API Terraform Configuration

This Terraform configuration deploys the Threadloaf API to AWS with a complete infrastructure setup.

## Architecture

- **VPC**: Custom VPC with public subnet in us-east-1c
- **EC2**: t4g.micro Ubuntu ARM64 instance with Elastic IP
- **IAM**: Instance role with Session Manager and Parameter Store access
- **Security**: Security group allowing HTTP/HTTPS traffic only
- **Parameter Store**: Secure storage for .env file and release URL
- **Auto-deployment**: Cloud-init script handles Node.js installation and service setup

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.0 installed
3. S3 bucket named `threadloaf-terraform-prod` created for state storage

## Usage

### Initial Setup

```bash
# Initialize Terraform
terraform init

# Review the planned infrastructure changes
terraform plan

# Apply the configuration (when ready to deploy)
terraform apply
```

### Parameter Configuration

After deployment, manually set these Parameter Store values in the AWS Console:

1. **`/threadloaf/api/env`** (SecureString): Complete .env file content for the API
2. **`/threadloaf/api/release-url`** (String): URL to download the API release zip file

### Deployment Process

1. The EC2 instance will automatically:
   - Install Node.js 18.x
   - Download the API release from the configured URL
   - Extract and set up the application
   - Create a systemd service
   - Start the API server

2. Access the server:
   - **API**: HTTP access via the Elastic IP (see outputs)
   - **Shell**: Use Session Manager (see session_manager_command output)

### Important Notes

- No SSH access is configured - use AWS Session Manager for shell access
- The API will restart automatically if it crashes
- Security groups only allow HTTP (80) and HTTPS (443) traffic
- The .env file is stored securely and only accessible by the EC2 instance

### Outputs

After deployment, important values are displayed including:
- Elastic IP address
- Instance ID
- Parameter Store parameter names
- Session Manager connection command

### Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will permanently delete all AWS resources created by this configuration. 