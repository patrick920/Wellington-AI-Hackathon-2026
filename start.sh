#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Waste Opportunities - one-click start for macOS and Linux
#  Run with:   ./start.sh      (you may need:  chmod +x start.sh  first)
# ---------------------------------------------------------------------------
set -e
cd "$(dirname "$0")"

echo ""
echo "  Starting Waste Opportunities..."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  ERROR: Node.js is not installed."
  echo "  Install it from https://nodejs.org (version 18 or newer)"
  exit 1
fi

# No install is needed for the default AI provider (Google Gemini) - it uses
# plain fetch. The optional Anthropic SDK is only for the Claude provider, so
# never let npm failing stop the app from starting.
if [ ! -d "node_modules" ]; then
  echo "  Installing optional dependencies (safe to skip if this fails)..."
  npm install --no-audit --no-fund || echo "  (skipped - the Gemini provider does not need it)"
  echo ""
fi

if [ ! -f ".env" ]; then
  echo "  NOTE: No .env file found, so the chatbot will use the offline assistant."
  echo "        For the full AI: cp .env.example .env  then add a free"
  echo "        Gemini key from https://aistudio.google.com/apikey"
  echo ""
fi

# Open the browser shortly after the server boots
( sleep 2
  if command -v open >/dev/null 2>&1; then open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  fi ) &

node server/server.js
