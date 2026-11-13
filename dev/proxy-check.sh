#!/usr/bin/env bash
# Sends allowed and refused requests through the Perses proxy of the dev stack and checks the status codes.
# The datasource allow-list refuses everything but GET on list endpoints (403 from Perses); a watch passes the
# path check and is refused by RBAC instead (403 from the API server).
set -uo pipefail

BASE="${PERSES_URL:-http://127.0.0.1:18083}/proxy/globaldatasources/kubernetes"
fail=0

check() {
  local want="$1" method="$2" path="$3" got
  got="$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$BASE$path")"
  if [ "$got" = "$want" ]; then
    printf 'ok    %s %-6s %s\n' "$got" "$method" "$path"
  else
    printf 'FAIL  %s %-6s %s (want %s)\n' "$got" "$method" "$path" "$want"
    fail=1
  fi
}

# Allowed: list endpoints.
check 200 GET /api/v1/namespaces
check 200 GET /api/v1/nodes
check 200 GET /api/v1/pods
check 200 GET /api/v1/namespaces/shop/pods
check 200 GET /api/v1/namespaces/shop/events
check 200 GET /apis/apps/v1/namespaces/shop/deployments
check 200 GET /apis/example.com/v1/namespaces/demo/widgets
# Refused by the allow-list (Perses).
check 403 POST /api/v1/namespaces/shop/pods
check 403 DELETE /api/v1/namespaces/shop/pods
check 403 PUT /api/v1/namespaces/shop/pods
check 403 PATCH /apis/apps/v1/namespaces/shop/deployments
check 403 GET /api/v1/secrets
check 403 GET /api/v1/namespaces/shop/secrets
check 403 GET /api/v1/namespaces/kube-system/secrets
check 403 GET /api/v1/configmaps
check 403 GET /api/v1/namespaces/shop/pods/web
check 403 GET /api/v1/namespaces/shop/pods/web/exec
check 403 GET /api/v1/namespaces/shop/pods/web/log
check 403 GET /api/v1/namespaces/shop/pods/web/attach
check 403 GET /api/v1/namespaces/shop/pods/web/portforward
check 403 GET /api/v1/namespaces/shop/services/web/proxy
check 403 GET /api/v1/nodes/node/proxy
check 403 GET /api/v1/watch/pods
check 403 GET /apis/rbac.authorization.k8s.io/v1/clusterroles
check 403 GET /apis
check 403 GET /version
# Passes the path check, refused by RBAC: no watch verb.
check 403 'GET' '/api/v1/pods?watch=true'

exit "$fail"
