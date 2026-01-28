#!/bin/sh
set -eu

API_BASE_URL_VALUE=${API_BASE_URL:-}
ESCAPED_API_BASE_URL=$(printf '%s' "$API_BASE_URL_VALUE" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat <<CONFIG > /usr/share/nginx/html/config.js
window.__APP_CONFIG__ = { API_BASE_URL: "${ESCAPED_API_BASE_URL}" };
CONFIG

exec "$@"
