#!/bin/sh
set -e

npx prisma migrate deploy
if [ "${RUN_SEED:-0}" = "1" ]; then
  npx prisma db seed
fi
node dist/src/main.js
