#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/.."

echo "[AIIA Benchmark] Launching Master Empirical Validation Battery..."
npx tsx tests/runner.ts
