#!/usr/bin/env bash
# Build + publicación de dist/ en el servidor. Uso: pnpm deploy:prod
set -euo pipefail
HOST="${DEPLOY_HOST:-root@217.77.3.87}"
DEST="/var/www/colecta.vidamas.uno/html/"

cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm build
pnpm audit --audit-level high

# .well-known se excluye para no borrar retos ACME en curso durante una renovación
rsync -az --delete --exclude .htaccess --exclude .well-known dist/ "$HOST:$DEST"
ssh "$HOST" "chown -R www-data:www-data $DEST"

code=$(curl -s -o /dev/null -w "%{http_code}" https://colecta.vidamas.uno/)
echo "https://colecta.vidamas.uno/ → $code"
[ "$code" = "200" ]
