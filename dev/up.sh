#!/usr/bin/env bash
# Starts the dev stack: a kind cluster with Perses, this plugin, the Honeycomb panel and some broken workloads.
#
#   dev/up.sh        build the plugin, create the cluster, deploy everything
#   dev/down.sh      delete the cluster
#
# Needs kind, kubectl, curl, npm and percli. KIND_EXPERIMENTAL_PROVIDER=podman works too.
# The kubeconfig goes to dev/.kubeconfig, never ~/.kube/config, and every kubectl call names the context.
set -euo pipefail

DEV_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DEV_DIR")"
CLUSTER=perses-plugin-kubernetes
CONTEXT="kind-$CLUSTER"
export KUBECONFIG="$DEV_DIR/.kubeconfig"
HONEYCOMB_VERSION=0.2.0
HONEYCOMB_URL="https://github.com/astrona-io/perses-plugin-honeycomb/releases/download/v$HONEYCOMB_VERSION/Honeycomb-$HONEYCOMB_VERSION.tar.gz"

k() { kubectl --context "$CONTEXT" "$@"; }

echo "==> Building the plugin archive"
(cd "$ROOT" && npm run build >/dev/null && percli plugin build >/dev/null)
mkdir -p "$DEV_DIR/archive/kubernetes" "$DEV_DIR/archive/honeycomb"
rm -f "$DEV_DIR/archive/kubernetes/"*.tar.gz
cp "$ROOT"/Kubernetes-*.tar.gz "$DEV_DIR/archive/kubernetes/"

if [ ! -f "$DEV_DIR/archive/honeycomb/Honeycomb-$HONEYCOMB_VERSION.tar.gz" ]; then
  echo "==> Downloading the Honeycomb panel v$HONEYCOMB_VERSION"
  tmp="$(mktemp -d)"
  curl -fsSL -o "$tmp/Honeycomb-$HONEYCOMB_VERSION.tar.gz" "$HONEYCOMB_URL"
  curl -fsSL -o "$tmp/Honeycomb-$HONEYCOMB_VERSION.tar.gz.sha256" "$HONEYCOMB_URL.sha256"
  (cd "$tmp" && shasum -a 256 -c "Honeycomb-$HONEYCOMB_VERSION.tar.gz.sha256")
  mv "$tmp/Honeycomb-$HONEYCOMB_VERSION.tar.gz" "$DEV_DIR/archive/honeycomb/"
  rm -rf "$tmp"
fi

if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  echo "==> Creating the kind cluster $CLUSTER"
  sed "s|__DEV_DIR__|$DEV_DIR|g" "$DEV_DIR/kind.yaml" >"$DEV_DIR/.kind.yaml"
  kind create cluster --config "$DEV_DIR/.kind.yaml" --kubeconfig "$KUBECONFIG" --wait 120s
  rm -f "$DEV_DIR/.kind.yaml"
fi

echo "==> Workloads, RBAC and the demo custom resource"
k apply -f "$DEV_DIR/k8s/workloads.yaml" >/dev/null
k wait --for condition=established --timeout=60s crd/widgets.example.com >/dev/null
k apply -f "$DEV_DIR/k8s/widgets.yaml" >/dev/null

echo "==> Perses"
api_ip="$(k get service kubernetes -n default -o jsonpath='{.spec.clusterIP}')"
sed "s|__API_SERVER_IP__|$api_ip|g" "$DEV_DIR/k8s/perses.yaml" | k apply -f - >/dev/null
k apply -f "$ROOT/deploy/rbac.yaml" -f "$DEV_DIR/k8s/widgets-rbac.yaml" >/dev/null
k rollout restart deployment/perses -n perses >/dev/null
k rollout status deployment/perses -n perses --timeout=180s

echo "==> Waiting for http://127.0.0.1:18083"
for _ in $(seq 1 60); do
  curl -fs -o /dev/null http://127.0.0.1:18083/api/v1/health && break
  sleep 2
done
echo "Perses: http://127.0.0.1:18083/projects/kubernetes/dashboards/cluster-overview"
echo "Proxy checks: dev/proxy-check.sh"
