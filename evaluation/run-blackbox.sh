#!/usr/bin/env bash
# Usage: run-blackbox.sh <Backend dir> <port> <db name> <label>
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIR=$1; PORT=$2; DB=$3; LABEL=$4
cd "$DIR"
env OPENAI_API_KEY=test-key OPENAI_BASE_URL=http://127.0.0.1:9100/v1 OPENAI_TIMEOUT_MS=2000 OPENAI_MAX_RETRIES=0 \
    RATE_LIMIT_MAX=30 MONGODB_URI=mongodb://127.0.0.1:27017/$DB PORT=$PORT MOCK_DELAY_MS=4000 \
    node server.js > /tmp/srv-$LABEL.log 2>&1 &
PID=$!
for i in $(seq 1 50); do curl -s -m 1 localhost:$PORT/health >/dev/null && break; sleep 0.2; done
cd "$SCRIPT_DIR/.."
BASE_URL=http://localhost:$PORT node --test --test-reporter=spec evaluation/blackbox.test.mjs > /tmp/bb-$LABEL.txt 2>&1
kill $PID 2>/dev/null; wait $PID 2>/dev/null
grep -E "^✔|^✖|^ℹ (tests|pass|fail)" /tmp/bb-$LABEL.txt | awk '!seen[$0]++'
