# Plan

How `perses-plugin-kubernetes` is put together. Decisions and their reasons are in [DECISIONS.md](DECISIONS.md).

## Goal

Read the Kubernetes API live and read-only from Perses dashboards, through the Perses backend proxy, so that:

- variables list what exists now (namespaces, deployments, pods, custom resources) and chain;
- Kubernetes events show in the upstream LogsTable panel;
- the current state of objects shows in time series panels, in particular `perses-plugin-honeycomb`.

## Query types available in Perses 0.55

`@perses-dev/plugin-system` 0.55.1 defines these plugin types: `Variable`, `Datasource`, `TimeSeriesQuery`,
`TraceQuery`, `ProfileQuery`, `LogQuery`, `AlertsQuery`, `SilencesQuery`, `JsonQuery`, `Annotation`, `Panel`, `Explore`. There is no dedicated tabular type; `JsonQuery` is the closest (see DECISIONS). The mapping:

| Need                         | Plugin                       | Type              |
| ---------------------------- | ---------------------------- | ----------------- |
| API server, proxy, auth      | `KubernetesDatasource`       | `Datasource`      |
| Lists of objects as values   | `KubernetesResourceVariable` | `Variable`        |
| Events                       | `KubernetesEventsQuery`      | `LogQuery`        |
| Current state of objects     | `KubernetesStateQuery`       | `TimeSeriesQuery` |
| A generic table of resources | not built                    | see the proposal  |

## Data model

### Datasource

`spec.proxy` is an upstream `HTTPProxy` (`url`, `secret`, `allowedEndpoints`, `headers`, `timeout`). There is no
`directUrl`. The client (`KubernetesClient`) holds the proxy URL Perses gives the datasource and has one method,
`list(path, params)`, which sends `GET` with `limit` and `continue` and returns the `items` and the next `continue`
token.

### Shared model (`src/model/`)

- `resources.ts`: the builtin resources and their API paths, custom resource parsing (`group/version/plural`),
  `listPath()` (list paths only, namespace checked as a DNS label), and resources that are never readable.
- `jsonpath.ts`: the JSONPath subset (`.a.b`, `['k']`, `[0]`, `[*]`, `[?(@.f=="v")]`, `!=`, `||` fallbacks).
- `variables.ts`: resolves namespace and list fields from variables (`$var`, `${var}`, comma lists, "All", `*`).
- `query.ts`: `listObjects()`: one paged list per namespace, up to 500 objects per page and 5000 per query; beyond
  that the result is truncated and the state query adds a notice and the events query sets `hasMore`.

### Variable

`resource`, `customResource`, `namespace`, `labelSelector`, `fieldSelector`, `valueField` (default
`.metadata.name`), `labelField`, `filter`. Output: sorted, de-duplicated `{value, label}` options. `dependsOn` lists
every variable used in the namespace, selectors and filter, so a child reloads when a parent changes.

### Events query (LogQuery)

`namespace`, `involvedObjectKind`, `involvedObjectName`, `type`, `reason` (regex), `limit` (default 1000, max 5000).
Kind, name and type become a field selector; the reason is filtered in the browser. Output: `LogData` with one entry
per event, at `lastTimestamp` (or `eventTime`, `firstTimestamp`, `creationTimestamp`), inside the time range, newest
first. Line: `<reason>: <message>`. Labels: `level`, `type`, `reason`, `namespace`, `kind`, `object`, `count`,
`source`.

### State query (TimeSeriesQuery)

`resource`, `customResource`, `namespace`, `labelSelector`, `fieldSelector`, `stateField` (default `.status.phase`),
`stateMapping` (`[{value, code}]`), `labelFields` (`[{name, path}]`). Output: one series per object, one point at the
end of the time range. Labels: `name`, `namespace`, `kind`, `state` and the label fields. Unmapped states give `-1`.

## Components

```
src/
  datasources/kubernetes-datasource/
    KubernetesDatasource.tsx          createClient, default allow-list
    KubernetesDatasourceEditor.tsx    URL, secret, allow-list editor with warnings
    AllowedEndpointsEditor.tsx
    allowed-endpoints.ts              defaults, custom resource entries, safety checks
  variables/kubernetes-resource-variable/
    KubernetesResourceVariable.tsx    getVariableOptions, dependsOn
    KubernetesResourceVariableEditor.tsx
  queries/kubernetes-events-query/
    KubernetesEventsQuery.tsx         getLogData, dependsOn
    KubernetesEventsQueryEditor.tsx
  queries/kubernetes-state-query/
    KubernetesStateQuery.tsx          getTimeSeriesData, dependsOn
    KubernetesStateQueryEditor.tsx
  components/                         shared editor fields (resource, namespace, selectors, pair lists)
  model/                              resources, JSONPath, variables, paging
```

## Schemas

One CUE schema per plugin under `schemas/`, each with a JSON example and `tests/valid` and `tests/invalid` cases.
The datasource schema enforces the security rules: proxy only, a non-empty allow-list, `GET` only, anchored
patterns, no pattern mentioning secrets, exec, attach, portforward, proxy, log or watch, and no OAuth passthrough.

## Security

1. Proxy only; the browser never sees the token.
2. Allow-list of anchored `GET` list patterns, enforced by the Perses proxy.
3. The plugin only builds list paths, validates namespaces and refuses secrets and token resources.
4. RBAC in `deploy/rbac.yaml`: `get` and `list`, never `watch`.

Tests: unit tests of the allow-list in TypeScript and in Go (`test/allowlist`, Go's `regexp` like the proxy), CUE
invalid cases, and `dev/proxy-check.sh` against a running Perses.

## Dev stack

`dev/up.sh` creates a kind cluster, runs Perses in it with a service account bound by `deploy/rbac.yaml`, loads this
plugin and the honeycomb panel from archives, provisions the datasource, secret, project and two dashboards, and
deploys failing workloads (CrashLoopBackOff, ImagePullBackOff, Pending, CreateContainerConfigError) plus a custom
resource with ready, reconciling and failed objects.

## Open questions

- Tables of resources through `JsonQuery` and the Table panel: drafted in [upstream-proposal.md](upstream-proposal.md), not filed.
- History of state: out of scope. Kubernetes keeps no history; use kube-state-metrics for that.
- Watch-based live updates: out of scope on purpose (the proxy can't refuse `?watch=true`; RBAC does).
