#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required but not found." >&2
  exit 1
fi

STATUS_OUTPUT="$(npx supabase status -o env 2>/dev/null || true)"

if [[ -z "$STATUS_OUTPUT" ]]; then
  echo "Failed to read local Supabase env. Start stack first: npm run db:local:start" >&2
  exit 1
fi

strip_quotes() {
  local value="$1"
  value="${value%\"}"
  value="${value#\"}"
  printf '%s' "$value"
}

API_URL=""
ANON_KEY=""
SERVICE_ROLE_KEY=""

while IFS= read -r line; do
  line="${line#export }"

  case "$line" in
    API_URL=*)
      API_URL="$(strip_quotes "${line#API_URL=}")"
      ;;
    ANON_KEY=*)
      ANON_KEY="$(strip_quotes "${line#ANON_KEY=}")"
      ;;
    SERVICE_ROLE_KEY=*)
      SERVICE_ROLE_KEY="$(strip_quotes "${line#SERVICE_ROLE_KEY=}")"
      ;;
  esac
done <<< "$STATUS_OUTPUT"

if [[ -z "$API_URL" || -z "$ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Missing required values from supabase status output (API_URL/ANON_KEY/SERVICE_ROLE_KEY)." >&2
  echo "$STATUS_OUTPUT" >&2
  exit 1
fi

read_existing_or_default() {
  local key="$1"
  local fallback="$2"

  if [[ -f .env.local ]]; then
    local found
    found="$(grep -E "^${key}=" .env.local | tail -n 1 | cut -d'=' -f2- || true)"
    if [[ -n "$found" ]]; then
      printf '%s' "$found"
      return
    fi
  fi

  printf '%s' "$fallback"
}

ADMIN_BOOTSTRAP_EMAIL="$(read_existing_or_default "ADMIN_BOOTSTRAP_EMAIL" "admin@local.test")"
NEXT_PUBLIC_SITE_URL="$(read_existing_or_default "NEXT_PUBLIC_SITE_URL" "http://127.0.0.1:3000")"
RATE_LIMIT_WINDOW_SECONDS="$(read_existing_or_default "RATE_LIMIT_WINDOW_SECONDS" "60")"
RATE_LIMIT_MAX_SIGNUP="$(read_existing_or_default "RATE_LIMIT_MAX_SIGNUP" "5")"
RATE_LIMIT_MAX_LOGIN="$(read_existing_or_default "RATE_LIMIT_MAX_LOGIN" "10")"
RATE_LIMIT_MAX_POST="$(read_existing_or_default "RATE_LIMIT_MAX_POST" "10")"
RATE_LIMIT_MAX_COMMENT="$(read_existing_or_default "RATE_LIMIT_MAX_COMMENT" "20")"
RATE_LIMIT_MAX_REPORT="$(read_existing_or_default "RATE_LIMIT_MAX_REPORT" "10")"

TMP_FILE=".env.local.tmp"
cat > "$TMP_FILE" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ADMIN_BOOTSTRAP_EMAIL=$ADMIN_BOOTSTRAP_EMAIL
RATE_LIMIT_WINDOW_SECONDS=$RATE_LIMIT_WINDOW_SECONDS
RATE_LIMIT_MAX_SIGNUP=$RATE_LIMIT_MAX_SIGNUP
RATE_LIMIT_MAX_LOGIN=$RATE_LIMIT_MAX_LOGIN
RATE_LIMIT_MAX_POST=$RATE_LIMIT_MAX_POST
RATE_LIMIT_MAX_COMMENT=$RATE_LIMIT_MAX_COMMENT
RATE_LIMIT_MAX_REPORT=$RATE_LIMIT_MAX_REPORT
EOF

mv "$TMP_FILE" .env.local

echo ".env.local synchronized from local Supabase status"
