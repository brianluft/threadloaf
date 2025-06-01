#!/bin/bash
set -euo pipefail
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ../src/threadloaf
npm run build

# Are we root?
if [ $(id -u) -eq 0 ]; then
    chown -R 1000:1000 ../../dist
fi
