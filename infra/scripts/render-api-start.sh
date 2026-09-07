#!/bin/sh
# Keep the Render startup command inside the image. Render treats dockerCommand
# as an argv-style override, which makes shell quoting for migration + exec
# brittle. This script is therefore the image CMD and remains testable locally.
set -eu

prisma_bin='./apps/api/node_modules/.bin/prisma'

attempt=1
while [ "$attempt" -le 3 ]; do
  if "$prisma_bin" migrate deploy --schema apps/api/prisma/schema.prisma; then
    exec node apps/api/dist/main.js
  fi

  if [ "$attempt" -eq 3 ]; then
    echo 'Prisma migration failed after 3 attempts.' >&2
    exit 1
  fi

  echo "Prisma migration attempt $attempt failed; retrying in 2 seconds." >&2
  attempt=$((attempt + 1))
  sleep 2
done
