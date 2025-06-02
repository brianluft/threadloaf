#!/bin/bash
set -euo pipefail

# cd to src/api
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ../src/api
npm install

# cd to src/threadloaf
cd ../threadloaf
npm install
