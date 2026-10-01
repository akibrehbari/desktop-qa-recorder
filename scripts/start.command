#!/bin/bash
# Double-click this file in Finder to launch the dashboard.
# Run setup.command first if you haven't already.
cd "$(dirname "$0")/.."

if [ ! -d ".venv" ] || [ ! -d "dashboard/node_modules" ]; then
  echo "It looks like setup hasn't run yet."
  echo "Double-click setup.command first, then try this again."
  echo ""
  read -r -p "Press Enter to close this window..."
  exit 1
fi

echo "=================================================="
echo " Starting Desktop QA Recorder..."
echo "=================================================="
echo ""
echo "Keep this window open while you use the app."
echo "Close it (or press Ctrl+C) when you're done."
echo ""
echo "macOS note: the first time you click 'Start Recording' or 'Run'"
echo "in the dashboard, you may be asked to grant Terminal access to"
echo "Accessibility / Input Monitoring. Click Allow -- it only asks once."
echo ""

cd dashboard
LOG_FILE="$(mktemp -t qa-recorder-dashboard)"
npm run dev > "$LOG_FILE" 2>&1 &
DEV_PID=$!

trap 'kill $DEV_PID 2>/dev/null' EXIT

URL=""
for _ in $(seq 1 30); do
  URL=$(grep -o 'http://localhost:[0-9]*' "$LOG_FILE" | head -1)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

if [ -n "$URL" ]; then
  echo "Opening $URL in your browser..."
  open "$URL"
else
  echo "Dashboard is starting -- open http://localhost:3000 in your browser."
fi

wait $DEV_PID
