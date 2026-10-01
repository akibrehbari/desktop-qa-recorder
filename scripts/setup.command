#!/bin/bash
# Double-click this file in Finder to set everything up.
# (First time only -- after this, just use start.command.)
set -e
cd "$(dirname "$0")/.."

echo "=================================================="
echo " Desktop QA Recorder -- first-time setup"
echo "=================================================="
echo ""

fail() {
  echo ""
  echo "Setup could not finish: $1"
  echo ""
  read -r -p "Press Enter to close this window..."
  exit 1
}

if ! command -v python3 >/dev/null 2>&1; then
  fail "Python 3 isn't installed. Install it from https://www.python.org/downloads/ (or 'brew install python3'), then double-click this file again."
fi

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js isn't installed. Install it from https://nodejs.org (choose the LTS version), then double-click this file again."
fi

echo "Found Python: $(python3 --version)"
echo "Found Node:   $(node --version)"
echo ""

echo "-- Setting up the recording/replay engine..."
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo "-- Setting up the dashboard (this can take a minute)..."
cd dashboard
npm install --silent
cd ..

echo ""
echo "=================================================="
echo " Setup complete!"
echo ""
echo " Next: double-click start.command to launch the app."
echo "=================================================="
echo ""
read -r -p "Press Enter to close this window..."
