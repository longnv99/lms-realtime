#!/bin/sh
set -eu

npm run db:migrate:deploy --workspace=backend
exec "$@"
