#!/bin/bash
set -euo pipefail

# cd to scripts
cd "$( dirname "${BASH_SOURCE[0]}" )"

# If the API is already running, stop it
./stop-api.sh

# cd to src/api
cd ../src/api

# Build the API
npm run build

# Run the API in the background
npm start 2>&1 >api_log &
PID=$!

# Give it a few seconds to crash at startup, if it wants to do that.
sleep 3

# Is PID still running?
if ! ps -p $PID > /dev/null; then
    cat api_log
    echo "API failed to start!"
    exit 1
fi

echo "API is running at http://localhost:3000"
