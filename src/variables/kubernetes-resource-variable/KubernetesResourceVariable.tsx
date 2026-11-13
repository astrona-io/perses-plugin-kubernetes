import type { VariablePlugin } from '@perses-dev/plugin-system';

import { variablesIn } from '../../model/variables';
import { getVariableOptions } from './get-variable-options';
import type { KubernetesResourceVariableSpec } from './kubernetes-resource-variable-types';
import { KubernetesResourceVariableEditor } from './KubernetesResourceVariableEditor';

export const KubernetesResourceVariable: VariablePlugin<KubernetesResourceVariableSpec> = {
  getVariableOptions,
  OptionsEditorComponent: KubernetesResourceVariableEditor,
  createInitialOptions: () => ({ resource: 'namespaces' }),
  dependsOn: (spec) => ({
    variables: variablesIn(spec.namespace, spec.labelSelector, spec.fieldSelector, spec.customResource, spec.filter),
  }),
};
