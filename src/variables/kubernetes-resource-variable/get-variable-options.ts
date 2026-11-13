import type { VariableOption, VariablePlugin } from '@perses-dev/plugin-system';

import type { KubernetesObject } from '../../datasources/kubernetes-datasource/kubernetes-datasource-types';
import { selectAll, selectFirst } from '../../model/jsonpath';
import { getClient, listObjects } from '../../model/query';
import { resolveResource } from '../../model/resources';
import { resolveNamespaces, resolveText } from '../../model/variables';
import type { KubernetesResourceVariableSpec } from './kubernetes-resource-variable-types';
import { DEFAULT_VALUE_FIELD } from './kubernetes-resource-variable-types';

/**
 * Turns listed objects into variable options: one option per distinct value (a JSONPath that yields several
 * values, e.g. `.spec.containers[*].image`, gives several options), kept when it matches `filter`, sorted.
 */
export function objectsToOptions(objects: KubernetesObject[], spec: KubernetesResourceVariableSpec): VariableOption[] {
  const valueField = spec.valueField?.trim() || DEFAULT_VALUE_FIELD;
  const labelField = spec.labelField?.trim() || undefined;
  const filter = spec.filter ? new RegExp(spec.filter) : undefined;
  const options = new Map<string, string>();
  for (const obj of objects) {
    for (const value of selectAll(obj, valueField)) {
      if (options.has(value) || (filter !== undefined && !filter.test(value))) {
        continue;
      }
      const label = labelField !== undefined ? (selectFirst(obj, labelField) ?? value) : value;
      options.set(value, label);
    }
  }
  return [...options.entries()].toSorted(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
}

export const getVariableOptions: VariablePlugin<KubernetesResourceVariableSpec>['getVariableOptions'] = async (
  spec,
  ctx,
  abortSignal,
) => {
  const ref = resolveResource(spec.resource, resolveText(spec.customResource, ctx.variables));
  const client = await getClient(ctx.datasourceStore, spec.datasource);
  const { items } = await listObjects(client, {
    ref,
    namespaces: resolveNamespaces(spec.namespace, ctx.variables),
    labelSelector: resolveText(spec.labelSelector, ctx.variables),
    fieldSelector: resolveText(spec.fieldSelector, ctx.variables),
    signal: abortSignal,
  });
  // The filter may refer to other variables, e.g. `^$deployment-` to chain pods to a deployment variable.
  return { data: objectsToOptions(items, { ...spec, filter: resolveText(spec.filter, ctx.variables) }) };
};
