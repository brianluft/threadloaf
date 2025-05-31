#!/bin/bash
set -euo pipefail

cd "$( dirname "${BASH_SOURCE[0]}" )"
cd ..

(cd src/api && npm run format)
(cd src/threadloaf && npm run format)
