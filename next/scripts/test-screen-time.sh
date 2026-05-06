#!/usr/bin/env bash
# Test the Screen Time API endpoint
# Usage: SCREEN_TIME_API_TOKEN=your-token ./scripts/test-screen-time.sh [base_url]
#
# Examples:
#   SCREEN_TIME_API_TOKEN=secret ./scripts/test-screen-time.sh http://localhost:3000
#   SCREEN_TIME_API_TOKEN=secret ./scripts/test-screen-time.sh https://pd.taras.cloud

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
TOKEN="${SCREEN_TIME_API_TOKEN:?Set SCREEN_TIME_API_TOKEN env var}"
TODAY=$(date +%Y-%m-%d)

echo "=== POST /api/health/screen-time (create) ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "${BASE_URL}/api/health/screen-time" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "'"${TODAY}"'",
    "totalMinutes": 187,
    "categories": {
      "social": 45,
      "productivity": 62,
      "entertainment": 30,
      "reading": 25,
      "other": 25
    },
    "topApps": [
      {"name": "Safari", "bundleId": "com.apple.mobilesafari", "minutes": 42, "category": "productivity"},
      {"name": "Instagram", "bundleId": "com.burbn.instagram", "minutes": 28, "category": "social"},
      {"name": "Telegram", "bundleId": "ph.telegra.Telegraph", "minutes": 17, "category": "social"}
    ],
    "pickups": 67,
    "notifications": 124
  }'

echo ""
echo "=== POST /api/health/screen-time (update same date) ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "${BASE_URL}/api/health/screen-time" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "'"${TODAY}"'",
    "totalMinutes": 195,
    "categories": {"social": 50, "productivity": 60, "entertainment": 35, "reading": 25, "other": 25},
    "topApps": [],
    "pickups": 70,
    "notifications": 130
  }'

echo ""
echo "=== GET /api/health/screen-time (last 30 days) ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X GET "${BASE_URL}/api/health/screen-time" \
  -H "Authorization: Bearer ${TOKEN}"

echo ""
echo "=== POST with invalid body (should 400) ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "${BASE_URL}/api/health/screen-time" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"date": "not-a-date", "totalMinutes": -5}'

echo ""
echo "=== GET without auth (should 401) ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X GET "${BASE_URL}/api/health/screen-time"
