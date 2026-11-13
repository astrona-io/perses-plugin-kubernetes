import type { TimeSeriesQueryPlugin } from '@perses-dev/plugin-system';

import { variablesIn } from '../../model/variables';
import { getTimeSeriesData } from './get-time-series-data';
import type { KubernetesStateQuerySpec } from './kubernetes-state-query-types';
import { KubernetesStateQueryEditor } from './KubernetesStateQueryEditor';

export const KubernetesStateQuery: TimeSeriesQueryPlugin<KubernetesStateQuerySpec> = {
  getTimeSeriesData,
  OptionsEditorComponent: KubernetesStateQueryEditor,
  createInitialOptions: () => ({ resource: 'pods' }),
  dependsOn: (spec) => ({
    variables: variablesIn(spec.namespace, spec.labelSelector, spec.fieldSelector, spec.customResource),
  }),
};
