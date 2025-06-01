#!/bin/bash
set -euo pipefail
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ../src/api
pkill -f "node dist/index.js" || true
echo "API is stopped."
echo "--- API log ---"

if [ -f api_log ]; then
    cat api_log
    rm api_log
fi