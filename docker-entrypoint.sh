#!/bin/sh
set -e

# Fly mounts a root-owned volume at /data. Give the unprivileged app user
# ownership, then drop privileges before starting Next.js.
if [ -d /data ]; then
  chown -R nextjs:nodejs /data 2>/dev/null || true
fi

exec gosu nextjs "$@"
