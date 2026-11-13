import { Stack } from '@mui/material';
import type { OptionsEditorProps } from '@perses-dev/plugin-system';
import type { ReactElement } from 'react';
import { useCallback } from 'react';

import { checkRegex, OptionalTextField, validationError } from '../../components/fields';
import { ROW_ON_WIDE } from '../../components/layout';
import { ResourceSelectionEditor } from '../../components/ResourceSelectionEditor';
import { validateJsonPath } from '../../model/jsonpath';
import type { KubernetesResourceVariableSpec } from './kubernetes-resource-variable-types';

export type KubernetesResourceVariableEditorProps = OptionsEditorProps<KubernetesResourceVariableSpec>;

export function KubernetesResourceVariableEditor(props: KubernetesResourceVariableEditorProps): ReactElement {
  const { value, onChange, isReadonly } = props;
  const setValueField = useCallback(
    (valueField: string | undefined) => onChange({ ...value, valueField }),
    [onChange, value],
  );
  const setLabelField = useCallback(
    (labelField: string | undefined) => onChange({ ...value, labelField }),
    [onChange, value],
  );
  const setFilter = useCallback((filter: string | undefined) => onChange({ ...value, filter }), [onChange, value]);
  return (
    <Stack spacing={2}>
      <ResourceSelectionEditor value={value} onChange={onChange} isReadonly={isReadonly} />
      <Stack direction={ROW_ON_WIDE} spacing={2}>
        <OptionalTextField
          label="Value field"
          placeholder=".metadata.name"
          helperText="JSONPath of the option value."
          value={value.valueField}
          onChange={setValueField}
          error={validationError(value.valueField, validateJsonPath)}
          readOnly={isReadonly}
          monospace
        />
        <OptionalTextField
          label="Label field"
          placeholder="same as the value"
          helperText="JSONPath of the text shown in the dropdown."
          value={value.labelField}
          onChange={setLabelField}
          error={validationError(value.labelField, validateJsonPath)}
          readOnly={isReadonly}
          monospace
        />
      </Stack>
      <OptionalTextField
        label="Filter"
        placeholder="^web-"
        helperText="Regular expression: only values that match are offered."
        value={value.filter}
        onChange={setFilter}
        error={validationError(value.filter, checkRegex)}
        readOnly={isReadonly}
        monospace
      />
    </Stack>
  );
}
