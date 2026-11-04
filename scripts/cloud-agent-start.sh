#!/usr/bin/env bash
set -euo pipefail

PORT=43129

# Some agent boots re-check out the branch and drop ignored dirs (node_modules).
# Rehydrate quietly so start stays self-contained without moving install fully here.
if [[ ! -d node_modules/next ]]; then
  echo "[cloud-agent-start] node_modules missing; running npm ci"
  npm ci
fi

if [[ ! -f .env.local ]]; then
  umask 077
  cat > .env.local <<'ENV'
NEXT_PUBLIC_BRAND=onestreet-uk
NEXT_PUBLIC_APP_URL=http://127.0.0.1:43129
DEMO_PUBLIC_INBOX=1
ENV
fi

# Free a stale Next.js listener from a previous session.
python3 - "$PORT" <<'PY'
import os, sys, signal
port = int(sys.argv[1])
hexport = f"{port:04X}"
inodes = set()
with open("/proc/net/tcp") as f:
    next(f)
    for line in f:
        parts = line.split()
        if len(parts) < 10:
            continue
        if parts[1].upper().endswith(":" + hexport):
            inodes.add(parts[9])
pids = set()
for pid in os.listdir("/proc"):
    if not pid.isdigit():
        continue
    fd_dir = f"/proc/{pid}/fd"
    try:
        for name in os.listdir(fd_dir):
            try:
                target = os.readlink(f"{fd_dir}/{name}")
            except OSError:
                continue
            if target.startswith("socket:[") and target[8:-1] in inodes:
                pids.add(int(pid))
    except OSError:
        continue
for pid in sorted(pids):
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
PY
sleep 1

exec npm run dev -- --hostname 0.0.0.0 --port "$PORT"
