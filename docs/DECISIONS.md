# Decisions

Decisions made while building `perses-plugin-kubernetes`, and why. The plan is in [PLAN.md](PLAN.md).

## Perses version: 0.55.1

The plugin is built against `@perses-dev/*` 0.55.1, `percli` v0.55.1 and tested with the `persesdev/perses:v0.55.1`
image. 0.55.1 is the latest stable Perses release (2026-11-02) and the version the sibling plugins are tested with
(`perses-plugin-honeycomb` 0.2.x). 0.56 is still in beta.

## Query type mapping

Perses 0.55.1 has these query plugin types: `TimeSeriesQuery`, `TraceQuery`, `ProfileQuery`, `LogQuery`,
`AlertsQuery`, `SilencesQuery` and `JsonQuery`. Kubernetes objects are not time series, so:

- **Variable first.** `KubernetesResourceVariable` replaces `label_values()` over kube-state-metrics, and is the
  part with the most value.
- **Events as logs.** `KubernetesEventsQuery` is a `LogQuery`, so the upstream LogsTable panel shows events with no new
  panel. The log line is `<reason>: <message>`; `level` is `warning` for `Warning` events and `info` otherwise, which
  is how LogsTable colours rows. Each event is placed at its `lastTimestamp` (then `eventTime`, `firstTimestamp`,
  `creationTimestamp`), and only events inside the time range are kept, so the time picker means what it says.
- **State as a time series snapshot.** `KubernetesStateQuery` is a `TimeSeriesQuery` with one point per object at the
  end of the time range. The value is a state code, the labels carry the object and its state, so any panel that
  reads the last value and labels (honeycomb, table, stat) works. There is no history: Kubernetes does not keep one.
- **Unmapped states are `-1`**, not 0 or a guess: a state nobody mapped must not look healthy. Panels can map `-1`
  to "unknown".

## A generic table of resources: not built

The prompt asks for a tabular query type proposal if none exists. One partly does: `JsonQuery` was added to the
plugin system, the upstream Table panel 0.14.1 (bundled with Perses 0.55.1) lists `JsonQuery` among its supported
query types (though it makes one row per query result, not per array element; see the proposal), and `perses/plugins` has a JSON datasource and `JsonQuery`
plugin (perses/plugins#770, still 0.2.0-beta, not bundled with Perses 0.55.1).

So a resource table needs no new query type: a `KubernetesResourcesQuery` (a `JsonQuery` that returns one flat row
per object, columns chosen by JSONPath) is the right shape, once the Table panel makes one row per array element. It is left out of 0.1.0 to keep the
scope to the four plugins asked for, and is the natural next plugin. Until then, a `KubernetesStateQuery` with
`labelFields` in the Table panel gives one row per object with chosen columns. The remaining gaps are written up in
[upstream-proposal.md](upstream-proposal.md), as a draft only.

## Security: four layers, each enough on its own for something

- **Proxy only.** The datasource spec has no `directUrl`; the CUE schema rejects it and OAuth passthrough.
- **Allow-list.** The Perses proxy compares the method for equality and matches `endpointPattern` (a Go regexp)
  anywhere in the path. Unanchored patterns are therefore unsafe (`/api/v1/pods` matches `.../pods/x/exec`), so every
  default pattern is anchored, and the schema and the editor reject unanchored patterns, non-GET methods, and patterns
  that mention secrets, exec, attach, portforward, proxy, log or watch. An empty allow-list makes the proxy forward
  everything, so the schema requires at least one entry.
- **The plugin builds list paths only.** Namespaces from variables are checked as DNS labels, so `x/pods/y/exec` can't
  add path segments. `secrets`, `serviceaccounts`, `tokenreviews` and `subjectaccessreviews` are refused even as a
  custom resource. Single objects are never fetched: list plus `fieldSelector=metadata.name=...` covers that need.
- **RBAC.** `get` and `list` only. The proxy does not look at the query string, so it can't refuse `?watch=true`;
  RBAC refuses it because `watch` is never granted. `dev/proxy-check.sh` checks that it returns 403.

The allow-list is tested three times: in TypeScript (the editor's own check), in Go with `regexp` (the engine the
proxy uses, `test/allowlist`), and end to end against a running Perses (`dev/proxy-check.sh`: 7 allowed, 20 refused).

## In-cluster credentials through secret files

Perses reads `credentialsFile` and `caFile` from disk on each request, so the projected service account token keeps
working when it rotates. Perses refuses secret files outside `security.secret_file_allowed_directories`; the README
and the dev stack allow only `/var/run/secrets/kubernetes.io/serviceaccount`. The proxy also refuses private
addresses unless they are in `datasource.proxy.allowed_networks`; the docs allow the API server's service IP as a
`/32`, not the whole service range.

## Paging and limits

Lists use `limit=500` and follow `continue` up to 5000 objects per query. Beyond that the result is cut (the state query adds
a notice, the events query sets `hasMore`), rather than paging without bound through a large cluster on every refresh. Events default to
the newest 1000, at most 5000.

## Multi-value namespaces and "All"

A multi-value namespace variable gives one list request per namespace. Perses passes every option when "All" is
chosen, which would mean one request per namespace in the cluster, so a namespace variable can set
`customAllValue: "*"` and the plugin turns `*` (or `$__all`) into one cluster-wide request. Fields are interpolated in
`csv` format so `a,b` splits cleanly instead of becoming the regex `(a|b)`.

## Pod state field

`.status.phase` is the default `stateField` because it exists on every pod. It hides the interesting failures (a
crash-looping pod is `Running`), so the docs and demo dashboards use
`.status.containerStatuses[*].state.waiting.reason || .status.containerStatuses[*].state.terminated.reason || .status.phase`.
The `terminated.reason` fallback matters: between restarts a crash-looping container is briefly terminated with
`Error`, and without it the pod would flash green.

## JSONPath: a small subset, written here

The subset kubectl users write (`.a.b`, `['k']`, `[0]`, `[*]`, `[?(@.f=="v")]`, `!=`) plus `||` fallbacks. A full
JSONPath library would add a dependency and features (scripts, recursive descent) with no use here. Anything outside
the subset is a reported error, never silently ignored.

## Dev stack: Perses inside kind, not docker compose

Part 2 asks for a `docker-compose.yaml`. Here Perses runs as a pod inside the kind cluster instead, because the point
of the in-cluster setup is the service account: its projected token, the CA file, `kubernetes.default.svc` and the
RBAC binding only exist inside the cluster. A compose Perses would need a copied long-lived token, which is the
opposite of what the README recommends. The kind cluster is the fake-data generator: its workloads fail on purpose
(CrashLoopBackOff, ImagePullBackOff, Pending, CreateContainerConfigError) and a small CRD has ready, reconciling and
failed objects. `dev/up.sh` writes its own kubeconfig to `dev/.kubeconfig` and never changes the current context.

## Tests: Vitest, not Jest

Part 2 names Jest + React Testing Library, and honeycomb uses Jest. This repo uses Vitest with React Testing Library
and `@testing-library/jest-dom` matchers: the tests read the same, run without a Babel or SWC Jest transform for the
ESM-only `@perses-dev` 0.55 packages, and are faster. Switching back is a mechanical change.

## No Grafana migration

Grafana has no Kubernetes API datasource to migrate from, so there is no `migrate/` schema.

## Upstream overlap

perses/perses#3761 "Plugin request: Kubernetes API" (opened 2026-01-05) is an open request with no comments, assignee
or pull request. No Kubernetes datasource exists in `perses/plugins` or the Perses community repos. This plugin is
written to be offered upstream as an answer to that request.
