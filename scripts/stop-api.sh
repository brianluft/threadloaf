#!/bin/bash
set -euo pipefail

# cd to root directory
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ..

# If api_pid exists, kill the process
if [ -f "api_pid" ]; then
    PID=$(cat api_pid)
    kill -9 "$PID" || true
    rm -f api_pid api_log
fi
