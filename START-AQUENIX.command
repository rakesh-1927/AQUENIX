#!/bin/bash
cd "$(dirname "$0")"
PORT=8000
python3 -m http.server "$PORT" --bind 127.0.0.1 &
SERVER_PID=$!
sleep 1
open "http://127.0.0.1:$PORT/"
echo "AQUENIX is running at http://127.0.0.1:$PORT/"
echo "Keep this window open. Press Ctrl+C to stop the server."
wait $SERVER_PID
