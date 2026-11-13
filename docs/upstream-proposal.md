# Draft: tables of Kubernetes resources in Perses

> **Status: draft, not filed.** This is a write-up to discuss with the Perses maintainers when the time is right. It
> has not been posted on any `perses/*` repository.

Related: perses/perses#3761 "Plugin request: Kubernetes API" (open, no pull request yet).

## Problem

`perses-plugin-kubernetes` reads the Kubernetes API through the Perses proxy and fits three of its needs into existing
plugin types: variables, events as a `LogQuery`, and object state as a one-point `TimeSeriesQuery`. The fourth need
does not fit well: a plain table of resources, one row per object, with columns such as namespace, name, image, node,
ready containers, restarts and age. Most of those columns are strings, and none of them is a time series.

Today the only way to get such a table is to abuse the state query: each object becomes a series whose labels are the
columns (`labelFields`) and whose value is a state code, shown in the Table panel. It works, but the value column is
meaningless for a plain listing, the time range has no meaning, and every column is a label string.

## What exists already

- The plugin system has a `JsonQuery` type (`getJsonData` returns `JsonData { data: unknown; metadata? }`), with no
  time range in its context.
- The Table panel (0.14.1, bundled with Perses 0.55.1) lists `JsonQuery` among its supported query types.
- `perses/plugins` has a JSON datasource and `JsonQuery` plugin (perses/plugins#770, 0.2.0-beta), which fetches a URL
  and applies a JSONata expression.

So no new query type is needed. A `KubernetesResourcesQuery` implemented as a `JsonQuery` would be the right shape.

## Gaps found

Read from `table/src/table-data-utils.ts` on `perses/plugins` main (2026-11-12); to be confirmed with the maintainers:

1. **One row per query, not per object.** `buildJsonTableData` turns each query result's `data` into a single row. A
   `data` that is an array of objects becomes one row whose columns are the array indexes, each cell a JSON string.
   A list of resources needs one row per array element.
2. **Nested values become JSON strings.** That is a fine default, but a query plugin that knows its data (a Kubernetes
   object) would rather declare its columns (name, JSONPath, type) than flatten in each plugin.
3. **No column types.** Ages, counts and timestamps can't be sorted or formatted as numbers or dates when every cell
   arrives as an untyped value. A small optional schema in `JsonData.metadata` (column name, type, unit) would let the
   Table panel format and sort correctly.
4. **Time independence is implicit.** A `JsonQuery` has no time range, which is right for "what exists now", but the
   panel gives no hint that the data is a snapshot. A metadata flag (for example `snapshotAt`) would let panels say so.

## Proposal

1. In the Table panel: when a `JsonQuery` result's `data` is an array, make one row per element (objects become rows,
   scalars a `value` column). This is backwards compatible for object results.
2. Optionally, a `columns` entry in `JsonMetadata` (`[{ name, type: 'string' | 'number' | 'time', unit? }]`) that the
   Table panel uses for headers, formatting and sorting when present.
3. Once that lands, add `KubernetesResourcesQuery` (a `JsonQuery`) to `perses-plugin-kubernetes`: resource, namespace,
   selectors and `columns: [{name, path}]` by JSONPath, returning one flat row per object.
4. If the maintainers want a Kubernetes datasource in `perses/plugins` (#3761), offer this plugin, including its
   security model (anchored GET allow-list, list paths only, RBAC without `watch`).

## Questions for the maintainers

- Is `JsonQuery` meant to be the general "tabular" query type, or is a dedicated table type planned?
- Would a typed `columns` description in `JsonMetadata` be welcome, or should panels infer types?
- For #3761: should a Kubernetes datasource live in `perses/plugins`, or stay a community plugin?
