#!/bin/bash
set -euo pipefail
cd "$( dirname "${BASH_SOURCE[0]}" )"

# Build api
echo "--- Build api ---"
cd ../src/api
npm run build

# Test api
echo "--- Test api ---"
npm test -- --randomize

# Build threadloaf
echo "--- Build threadloaf ---"
cd ../threadloaf
npm run build

# Are we root?
if [ $(id -u) -eq 0 ]; then
    chown -R 1000:1000 ../../dist
fi
