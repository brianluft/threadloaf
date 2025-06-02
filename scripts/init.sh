#!/bin/bash
set -euo pipefail

# Is `aws` installed?
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI."

    # Download the AWS CLI installer.
    architecture="$(dpkg --print-architecture)"
    if [ $architecture = "arm64" ]; then
    dist=aarch64
    elif [ $architecture = "amd64" ]; then
    dist=x86_64
    fi    
    curl https://awscli.amazonaws.com/awscli-exe-linux-$dist.zip -o /tmp/awscli.zip

    # Unzip the AWS CLI installer.
    unzip /tmp/awscli.zip -d /tmp

    # Run the install script.
    sudo sh /tmp/aws/install

    # Remove the installer files.
    rm -rv /tmp/aws /tmp/awscli.zip
fi


# cd to src/api
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ../src/api
npm install

# cd to src/threadloaf
cd ../threadloaf
npm install
