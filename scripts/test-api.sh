#!/bin/bash
set -euxo pipefail
cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ../src/api
npm test -- --randomize 2>&1 | tee /dev/null
