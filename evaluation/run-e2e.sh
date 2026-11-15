#!/usr/bin/env bash
# Usage: run-e2e.sh <project dir> <label> <screenshot dir or ->
ROOT=$1; LABEL=$2; SHOTS=$3
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/Frontend" && npm run build >/dev/null 2>&1
(npx vite preview --port 4173 --strictPort > /tmp/preview-$LABEL.log 2>&1 &)
cd "$ROOT/Backend"
node -e "import(\"mongoose\").then(async m=>{await m.default.connect(\"mongodb://127.0.0.1:27017/sigmagpt_e2e_$LABEL\");await m.default.connection.dropDatabase();await m.default.disconnect()})"
OPENAI_API_KEY=test-key OPENAI_BASE_URL=http://127.0.0.1:9100/v1 OPENAI_MAX_RETRIES=0 OPENAI_MODEL=openai/gpt-oss-20b \
  MONGODB_URI=mongodb://127.0.0.1:27017/sigmagpt_e2e_$LABEL PORT=8080 FRONTEND_ORIGIN=http://localhost:4173 \
  node server.js > /tmp/e2e-backend-$LABEL.log 2>&1 &
BPID=$!
for i in $(seq 1 40); do curl -s -m 1 localhost:8080/health >/dev/null && curl -s -m 1 localhost:4173 >/dev/null && break; sleep 0.25; done
python3 "$SCRIPT_DIR/e2e_ui.py" "$LABEL" "$BPID" "$SHOTS" > /tmp/e2e-$LABEL.json 2>/tmp/e2e-$LABEL.err
kill $BPID 2>/dev/null; pkill -f "vite preview --port 4173" 2>/dev/null
sleep 0.5
