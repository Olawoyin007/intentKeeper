#!/bin/sh
# Drop from root to PUID:PGID before starting the server.
#
# Without this the container writes root-owned files into bind-mounted
# host volumes and the host user can't edit them without sudo.
#
# Set PUID/PGID in your compose file or .env to match your host user:
#   id -u   # find your PUID
#   id -g   # find your PGID
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if ! getent group "$PGID" >/dev/null 2>&1; then
    groupadd -g "$PGID" intentkeeper
fi
if ! getent passwd "$PUID" >/dev/null 2>&1; then
    useradd -u "$PUID" -g "$PGID" -M -s /bin/sh -d /app intentkeeper
fi

# Repair ownership on writable paths so files written by a previous
# root run don't block the non-root user on restart.
for dir in /app/data /app/logs; do
    if [ -d "$dir" ]; then
        find "$dir" -not -uid "$PUID" -print0 2>/dev/null \
            | xargs -0 -r chown "$PUID:$PGID" 2>/dev/null || true
    fi
done

# exec + gosu: no extra shell layer, so SIGTERM from `docker stop`
# reaches uvicorn directly instead of being swallowed by a wrapper.
exec gosu "$PUID:$PGID" "$@"
