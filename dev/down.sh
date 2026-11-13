#!/usr/bin/env bash
# Deletes the dev cluster and its kubeconfig. Leaves the plugin archives in dev/archive.
set -euo pipefail
DEV_DIR="$(cd "$(dirname "$0")" && pwd)"
kind delete cluster --name perses-plugin-kubernetes --kubeconfig "$DEV_DIR/.kubeconfig"
rm -f "$DEV_DIR/.kubeconfig"
