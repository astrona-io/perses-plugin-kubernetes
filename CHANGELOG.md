# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-13

### Added

- `KubernetesDatasource`: reads a Kubernetes API server through the Perses proxy only, with a secret for
  the bearer token and CA, and a default allow-list of anchored `GET` patterns on list endpoints.
- `KubernetesResourceVariable`: variable values from any listable resource, with namespace, label and
  field selectors, JSONPath value and label fields, and a regex filter.
- `KubernetesEventsQuery`: a log query over Kubernetes events, filtered by namespace, involved object,
  type and reason, for the LogsTable panel.
- `KubernetesStateQuery`: a time series query giving each object's state as a number (`.status.phase`
  by default, with a configurable mapping and extra labels), for panels such as the honeycomb.
- `deploy/rbac.yaml`: least-privilege ClusterRole and namespaced Role (get and list, never watch).
- A `dev/` stack: kind, Perses, the plugin, RBAC and failing workloads.

[0.1.0]: https://github.com/astrona-io/perses-plugin-kubernetes/releases/tag/v0.1.0
