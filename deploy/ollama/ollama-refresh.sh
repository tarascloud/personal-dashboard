#!/bin/bash
# Nightly knowledge refresh for Ollama pd-assistant model
# Runs at 1:00 AM via cron
# Gathers user data from PD database, creates personalized Ollama model

set -euo pipefail

LOG_PREFIX="[ollama-refresh]"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PG_CONTAINER="pg"
OLLAMA_CONTAINER="ollama"
MODEL_NAME="pd-assistant"
DB_NAME="pd_prod"
DB_USER="pd"
MODELFILE_PATH="/tmp/pd-assistant-modelfile"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $LOG_PREFIX $1"; }

# Check containers are running
if ! docker inspect -f '{{.State.Running}}' "$PG_CONTAINER" 2>/dev/null | grep -q true; then
  log "ERROR: $PG_CONTAINER not running"
  exit 1
fi
if ! docker inspect -f '{{.State.Running}}' "$OLLAMA_CONTAINER" 2>/dev/null | grep -q true; then
  log "ERROR: $OLLAMA_CONTAINER not running"
  exit 1
fi

log "Starting knowledge refresh..."

# Query user data from PD database using SQL file
CONTEXT=$(docker exec -i "$PG_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A < "$SCRIPT_DIR/ollama-refresh.sql" 2>/dev/null)

if [ -z "$CONTEXT" ] || [ "$CONTEXT" = "null" ]; then
  log "WARNING: No data retrieved from database"
  CONTEXT="{}"
fi

log "Data collected (${#CONTEXT} bytes), generating Modelfile..."

# Create Modelfile with personalized system prompt
cat > "$MODELFILE_PATH" << 'EOF'
FROM gemma4:e4b

PARAMETER temperature 0.4
PARAMETER num_ctx 4096

SYSTEM """You are a personal AI assistant for Taras's Personal Dashboard.
You have deep knowledge of Taras's personal data: finances, health, fitness, nutrition, and investments.
Always answer in the same language the user writes in (Ukrainian or English).
Be concise, specific, and actionable. Use actual numbers from the data below.
When asked about finances, reference specific categories and amounts.
When asked about health, reference Garmin metrics, sleep scores, and trends.
When the user asks about a specific finance category, append: /filter category=CategoryName

EOF

# Append the data context
printf "\nHere is the current user data snapshot:\n%s\n" "$CONTEXT" >> "$MODELFILE_PATH"
echo '"""' >> "$MODELFILE_PATH"

# Create the model in Ollama
log "Creating model $MODEL_NAME..."
docker exec -i "$OLLAMA_CONTAINER" sh -c "cat > /tmp/Modelfile" < "$MODELFILE_PATH"
docker exec "$OLLAMA_CONTAINER" ollama create "$MODEL_NAME" -f /tmp/Modelfile 2>&1

# Verify
MODELS=$(docker exec "$OLLAMA_CONTAINER" ollama list 2>&1)
if echo "$MODELS" | grep -q "$MODEL_NAME"; then
  log "SUCCESS: Model $MODEL_NAME created/updated"
else
  log "ERROR: Model $MODEL_NAME not found after creation"
  exit 1
fi

# Cleanup
rm -f "$MODELFILE_PATH"
docker exec "$OLLAMA_CONTAINER" rm -f /tmp/Modelfile

log "Knowledge refresh complete"
