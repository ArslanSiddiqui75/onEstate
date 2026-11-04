#!/usr/bin/env bash
set -euo pipefail

PORT=43129

# Free a stale Next.js listener from a previous session (fuser is often absent).
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
        local = parts[1].upper()
        if local.endswith(":" + hexport):
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
