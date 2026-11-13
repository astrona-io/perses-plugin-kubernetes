import type { TimeSeriesQueryPlugin } from '@perses-dev/plugin-system';
import type { Notice, TimeSeries } from '@perses-dev/spec';

import type { KubernetesObject } from '../../datasources/kubernetes-datasource/kubernetes-datasource-types';
import { selectFirst } from '../../model/jsonpath';
import { getClient, listObjects } from '../../model/query';
import { kindOf, resolveResource } from '../../model/resources';
import { resolveNamespaces, resolveText } from '../../model/variables';
import type { KubernetesStateQuerySpec } from './kubernetes-state-query-types';
import { DEFAULT_STATE_FIELD, DEFAULT_STATE_MAPPING, UNMAPPED_CODE } from './kubernetes-state-query-types';

/**
 * One series per object, with a single point at `atMs`: the object's current state as a number.
 * Labels: name, namespace (when namespaced), kind, state, plus `labelFields`.
 */
export function objectsToSeries(
  objects: KubernetesObject[],
  spec: KubernetesStateQuerySpec,
  kind: string,
  atMs: number,
): TimeSeries[] {
  const stateField = spec.stateField?.trim() || DEFAULT_STATE_FIELD;
  const mapping = new Map((spec.stateMapping ?? DEFAULT_STATE_MAPPING).map((m) => [m.value, m.code]));
  const series: TimeSeries[] = [];
  for (const obj of objects) {
    const name = obj.metadata?.name ?? '';
    const namespace = obj.metadata?.namespace;
    const state = selectFirst(obj, stateField) ?? 'Unknown';
    const labels: Record<string, string> = { name, kind, state };
    if (namespace !== undefined) {
      labels.namespace = namespace;
    }
    for (const field of spec.labelFields ?? []) {
      const value = selectFirst(obj, field.path);
      if (value !== undefined && field.name !== '') {
        labels[field.name] = value;
      }
    }
    const id = namespace !== undefined ? `${namespace}/${name}` : name;
    series.push({
      name: id,
      formattedName: id,
      labels,
      values: [[atMs, mapping.get(state) ?? UNMAPPED_CODE]],
    });
  }
  return series.toSorted((a, b) => a.name.localeCompare(b.name));
}

export const getTimeSeriesData: TimeSeriesQueryPlugin<KubernetesStateQuerySpec>['getTimeSeriesData'] = async (
  spec,
  context,
  abortSignal,
) => {
  const ref = resolveResource(spec.resource, resolveText(spec.customResource, context.variableState));
  const client = await getClient(context.datasourceStore, spec.datasource);
  const { items, truncated, paths } = await listObjects(client, {
    ref,
    namespaces: resolveNamespaces(spec.namespace, context.variableState),
    labelSelector: resolveText(spec.labelSelector, context.variableState),
    fieldSelector: resolveText(spec.fieldSelector, context.variableState),
    signal: abortSignal,
  });
  const { start, end } = context.timeRange;
  const notices: Notice[] = truncated
    ? [
        {
          type: 'warning',
          message: 'Too many objects: the result is cut short. Narrow it with a namespace or selector.',
        },
      ]
    : [];
  return {
    series: objectsToSeries(items, spec, kindOf(ref), end.getTime()),
    timeRange: { start, end },
    stepMs: Math.max(end.getTime() - start.getTime(), 1),
    metadata: { executedQueryString: paths.join('\n'), notices },
  };
};
