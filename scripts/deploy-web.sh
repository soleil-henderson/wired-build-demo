#!/usr/bin/env bash
# Build and deploy public share pages to Vercel.
# Prerequisites: vercel login, EXPO_PUBLIC_* set in Vercel project settings.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build:web
echo "Deploying dist/ to Vercel..."
npx vercel deploy --prebuilt --prod
