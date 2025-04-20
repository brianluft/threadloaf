#!/bin/bash

# Exit on any error
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Get the root directory (two levels up from script directory)
ROOT_DIR="$( cd "$SCRIPT_DIR" && cd ../../ && pwd )"

echo "🧹 Cleaning up..."
rm -rf "$SCRIPT_DIR/node_modules" "$ROOT_DIR/dist" "$ROOT_DIR/publish"

echo "📁 Creating publish directory..."
mkdir -p "$ROOT_DIR/publish"

echo "📦 Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

echo "📚 Creating source archive..."
cd "$ROOT_DIR"
zip -r publish/source.zip . -x "publish/*" "*.git*"

echo "🔨 Building extension..."
cd "$SCRIPT_DIR"
npm run build

echo "📦 Creating extension archive..."
cd "$ROOT_DIR/dist"
zip -r ../publish/extension.zip .

echo "✨ Done! Release artifacts are in the publish/ directory:"
cd "$ROOT_DIR"
ls -l publish/ 