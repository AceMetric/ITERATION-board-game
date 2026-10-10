#!/bin/zsh
set -e
unsetopt BG_NICE
cd "$(dirname "$0")"
if /usr/bin/curl --silent --fail http://127.0.0.1:18794/ >/dev/null; then
  /usr/bin/open http://127.0.0.1:18794/
  exit 0
fi
/opt/homebrew/bin/node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 18794 &
preview_pid=$!
trap 'kill "$preview_pid" 2>/dev/null || true' EXIT INT TERM
for attempt in {1..40}; do
  if /usr/bin/curl --silent --fail http://127.0.0.1:18794/ >/dev/null; then
    /usr/bin/open http://127.0.0.1:18794/
    wait "$preview_pid"
    exit 0
  fi
  sleep 0.2
done
echo '审片页未能启动，请检查本窗口信息。'
exit 1
