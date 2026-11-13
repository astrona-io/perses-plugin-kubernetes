You are a senior TypeScript/React (and, where needed, Go/CUE) engineer and Perses contributor. Build the Perses plugin described below in this repository (`perses-plugin-kubernetes`). Work autonomously: plan, build, test, document. Open a PR when it's done.

---

# Part 1: What to build. Kubernetes datasource (+ variable, + events and snapshot queries)

**Repo:** `astrona-io/perses-plugin-kubernetes`
**Plugin kind(s):** Datasource: `KubernetesDatasource`; Variable: `KubernetesResourceVariable`; query plugins (see below)
**Focus area:** Shared foundation (feeds honeycomb, statetimeline and others)

## Why
There is no official Perses datasource for the Kubernetes API. Dashboards rely on `label_values()` over kube-state-metrics to list namespaces or pods (stale and approximate), and live details that Prometheus can't store (event messages, condition reasons, image tags, custom resources like Flux Kustomizations or Trivy reports) aren't available at all. This datasource reads the Kubernetes API **live and read-only**, through the Perses backend proxy.

## Before you start: check the plugin system's query types
Perses query plugins return typed data (time series, traces, logs, profiles, …). Find out exactly which query types the current plugin system supports. Kubernetes resources aren't time series, so plan the mapping:
1. **Variable plugin** (`KubernetesResourceVariable`): definitely supported, and the most valuable part. Build this first.
2. **Events as logs** (`KubernetesEventsQuery`, a log query plugin if log queries are supported): each Kubernetes event becomes a log line (timestamp, type as level, reason, object, message), so the upstream LogsTable and LogExplorer panels work with no new panel.
3. **Snapshot as time series** (`KubernetesStateQuery`, a time-series query plugin): current state of selected resources as one data point per object, with labels (namespace, name, phase, reason, node, image…) and a numeric state code. This lets `perses-plugin-honeycomb` show live pod state with no Prometheus in between.
4. A generic table of resources needs a tabular query type. If none exists, **don't build one here**: write a proposal in `docs/upstream-proposal.md` and raise it with the Perses maintainers.
Record the decisions in `docs/DECISIONS.md`.

## Datasource and security (most important part)
- All calls go through the **Perses backend HTTP proxy**. The browser never sees a token.
- Datasource config: API server URL, a reference to a Perses **secret** holding the bearer token (and CA bundle). Support in-cluster use: Perses running with a service account.
- **Read-only:** restrict the proxy to `GET` and to an allow-list of API paths. Look at how the upstream Prometheus datasource configures allowed endpoints and do the same. No `watch`, no `exec`, no `secrets`.
- Ship a least-privilege `ClusterRole` (get/list on pods, namespaces, nodes, deployments, statefulsets, daemonsets, replicasets, events, plus optional CRDs) and a `Role` variant for namespace-scoped setups, in `deploy/rbac.yaml`.
- Handle API pagination (`limit` / `continue`) and use label/field selectors server-side.

## Variable spec (options → CUE schema)
- `resource`: namespaces | pods | deployments | statefulsets | daemonsets | nodes | custom (`group/version/resource`)
- `namespace`: fixed value or a reference to another variable (e.g. `$namespace`), so variables chain
- `labelSelector`, `fieldSelector`
- `valueField` / `labelField`: JSONPath (default `.metadata.name`)
- `filter`: regex on the result

## Query specs
- Events query: namespace, involved object kind/name, type (Normal/Warning), reason regex.
- State query: resource, namespace, selectors, `stateField` (JSONPath, default `.status.phase`), `stateMapping` to numeric codes, extra label fields (JSONPath list).

## Acceptance criteria
- `dev/` runs a `kind` cluster with Perses, the plugin, the RBAC, and a few deliberately failing workloads (CrashLoopBackOff, ImagePullBackOff, Pending).
- Variables chain correctly (namespace → deployment → pod) and update when the parent changes.
- Events show up in the upstream logs table. Live pod state shows up in `perses-plugin-honeycomb` (add a demo dashboard).
- The proxy refuses non-GET requests and non-allow-listed paths. Tested.
- README: what it can and can't do vs kube-state-metrics, RBAC setup, in-cluster and out-of-cluster config.

## The plugin family this belongs to
This repo is part of the `astrona-io` Perses plugin set. Already built (read them before you start, and match their structure, tooling, CI and README style):
`perses-plugin-oat-results`, `perses-plugin-sankey`, `perses-plugin-statetimeline`, `perses-plugin-honeycomb`, `perses-plugin-geomap`, `perses-plugin-servicegraph`, all under https://github.com/astrona-io.
Use the same Perses version pin as those repos unless there's a newer stable release, then note it in `docs/DECISIONS.md`.

---

# Part 2: How to build it (Perses plugin guide)

You are building a **Perses plugin** in this repository. Perses is the CNCF
dashboard project (https://github.com/perses/perses). Its core plugins live in
https://github.com/perses/plugins.


## Ground rules

1. **Copy upstream conventions; don't invent your own.** Before writing code, clone
   `perses/plugins` next to this repo and read 2–3 plugins close to this one.
   Panels: `timeserieschart`, `statushistorychart`, `heatmapchart`, `table`.
   Datasources: `prometheus`, `tempo`, `victorialogs`.
   Match their folder layout, `package.json` (including the `perses` section),
   the CUE schema layout, and the rsbuild / module-federation config.
2. **Scaffold with percli. Never hand-build the directory structure.** Install
   `percli` from the Perses GitHub releases (or `brew install perses/tap/percli`).
   Then check the real flags with `percli plugin --help` and
   `percli plugin generate --help`. Flags change between releases, so don't
   trust memory or this file over `--help`.
   - `percli plugin generate …` scaffolds the module or plugin
   - `percli plugin start` runs it against a local Perses dev server
   - `percli plugin test-schemas` validates the CUE schemas and JSON examples
   - `percli plugin build` produces the distributable archive
3. **Use the latest stable Perses release.** Pin `@perses-dev/*` package versions
   to the release you develop against. Write that release in the README.
4. **Use the shared building blocks:**
   - `@perses-dev/plugin-system` for plugin types and hooks (`useDataQueries`,
     time range, variables)
   - `@perses-dev/components` for UI pieces, legends, tooltips and the ECharts wrapper
   - `@perses-dev/core` for value formatting, units and thresholds
   - Reuse the shared CUE types (`common.#format`, `common.#thresholds`, …) in schemas
5. **Theme-aware only.** No hard-coded colours. Use the MUI theme and the Perses
   chart theme so light and dark mode both work.
6. **Accessibility.** Status must never be shown by colour alone. Use icon,
   label or pattern too. Everything clickable must be reachable by keyboard.
7. **Performance.** Stay smooth at the "large" size named in Part 1.
   Memoise transforms. Don't re-render on hover.
8. **Licence.** Apache-2.0, same as Perses. Only add dependencies with
   compatible licences. Prefer libraries already used upstream (ECharts, MUI).
9. **Stay upstreamable.** Write it so it could be offered to `perses/plugins`
   later: same code style, lint config, tests and docs format. Before you start,
   search `perses/plugins` issues and PRs for this plugin. If someone is already
   building it, stop and report that.

## Local dev environment

Add a `dev/` folder with a `docker-compose.yaml` that starts:
- Perses (official image)
- the data backend this plugin needs (usually Prometheus)
- a **fake-data generator** that emits the metrics, logs or API responses in
  Part 1, with realistic labels and some failure cases

Also provision a demo dashboard that uses the plugin (`dev/dashboards/*.json`),
so `docker compose up` followed by `percli plugin start` shows it working.

## Definition of done

- [ ] Scaffolded with `percli`. Layout matches upstream plugins.
- [ ] CUE schema plus at least one JSON example. `percli plugin test-schemas` passes.
- [ ] Grafana migration (`migrate/` CUE) if Part 1 names a Grafana equivalent.
- [ ] Panel options editor for every option in the spec, with sensible defaults.
- [ ] Unit tests (Jest + React Testing Library) for data transforms and rendering.
      Cover the empty state, error state and large-data cases.
- [ ] Works in light and dark theme. Includes screenshots of both in `docs/`.
- [ ] `percli plugin build` produces an archive. CI builds it on every PR.
- [ ] A GitHub Actions release workflow attaches the archive to a GitHub release on `v*` tags.
- [ ] README covers what it does, install, the data it expects, the options, a screenshot,
      and the Perses version it was tested with.
- [ ] Every acceptance criterion in Part 1 is checked off in the PR description.

## Working style

- Plan first. Write `docs/PLAN.md` covering the data model, component tree,
  schema and open questions before writing code.
- Use small commits with conventional messages (`feat:`, `fix:`, `docs:`, `test:`).
- If something in Part 1 is unclear or seems wrong, record your decision in
  `docs/DECISIONS.md` and keep going. Don't stop for the sake of it.
