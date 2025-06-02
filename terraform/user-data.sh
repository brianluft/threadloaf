#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y curl unzip

# Install AWS CLI v2 for ARM64
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
unzip awscliv2.zip  
sudo ./aws/install
rm awscliv2.zip

# Install Node.js 18.x (LTS) for ARM64
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install CloudWatch Agent
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Create CloudWatch Agent configuration
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "metrics": {
    "namespace": "CWAgent",
    "metrics_collected": {
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 300
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 300,
        "resources": [
          "/"
        ]
      }
    }
  }
}
EOF

# Start CloudWatch Agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Create threadloaf user
useradd -m -s /bin/bash threadloaf

# Create application directory
mkdir -p /opt/threadloaf
chown threadloaf:threadloaf /opt/threadloaf

# Get release path from Parameter Store
RELEASE_PATH=$(aws ssm get-parameter --region ${region} --name "${release_path_parameter_name}" --query 'Parameter.Value' --output text)

# Download and extract API release from S3
cd /opt/threadloaf
aws s3 cp "s3://${s3_bucket}/$RELEASE_PATH" api-release.zip --region ${region}
unzip api-release.zip
rm api-release.zip
chown -R threadloaf:threadloaf /opt/threadloaf

# Get .env file content from Parameter Store and write it
aws ssm get-parameter --region ${region} --name "${env_parameter_name}" --with-decryption --query 'Parameter.Value' --output text > /opt/threadloaf/.env
chown threadloaf:threadloaf /opt/threadloaf/.env
chmod 600 /opt/threadloaf/.env

# Create systemd service file
cat > /etc/systemd/system/threadloaf-api.service << EOF
[Unit]
Description=Threadloaf API Server
After=network.target

[Service]
Type=simple
User=threadloaf
WorkingDirectory=/opt/threadloaf
ExecStart=/usr/bin/node dist/api-server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/threadloaf

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable threadloaf-api.service
systemctl start threadloaf-api.service

# Verify service status
sleep 5
systemctl status threadloaf-api.service 