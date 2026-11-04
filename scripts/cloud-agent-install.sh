#!/usr/bin/env bash
set -euo pipefail

# Dependency install for Cloud Agent builds. Idempotent.
npm ci

# Local demo env only when missing. Never invent production secrets here —
# Supabase/Stripe/Twilio stay optional; app falls back to demo mode.
if [[ ! -f .env.local ]]; then
  umask 077
  cat > .env.local <<'ENV'
NEXT_PUBLIC_BRAND=onestreet-uk
NEXT_PUBLIC_APP_URL=http://127.0.0.1:43129
DEMO_PUBLIC_INBOX=1
ENV
fi
