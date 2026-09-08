#!/bin/sh
set -eu

npx prisma migrate deploy --schema backend/prisma/schema.prisma
exec "$@"
