import type { LogQueryPlugin } from '@perses-dev/plugin-system';

import { variablesIn } from '../../model/variables';
import { getLogData } from './get-log-data';
import type { KubernetesEventsQuerySpec } from './kubernetes-events-query-types';
import { KubernetesEventsQueryEditor } from './KubernetesEventsQueryEditor';

export const KubernetesEventsQuery: LogQueryPlugin<KubernetesEventsQuerySpec> = {
  getLogData,
  OptionsEditorComponent: KubernetesEventsQueryEditor,
  createInitialOptions: () => ({}),
  dependsOn: (spec) => ({
    variables: variablesIn(spec.namespace, spec.involvedObjectKind, spec.involvedObjectName, spec.reason),
  }),
};
