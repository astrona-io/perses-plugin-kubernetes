import { Button, Stack } from '@mui/material';
import type { OptionsEditorProps } from '@perses-dev/plugin-system';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { OptionalTextField, validationError } from '../../components/fields';
import type { PairColumn } from '../../components/PairListEditor';
import { PairListEditor } from '../../components/PairListEditor';
import { ResourceSelectionEditor } from '../../components/ResourceSelectionEditor';
import { validateJsonPath } from '../../model/jsonpath';
import type { KubernetesStateQuerySpec } from './kubernetes-state-query-types';
import { DEFAULT_STATE_MAPPING } from './kubernetes-state-query-types';

const MAPPING_COLUMNS: [PairColumn, PairColumn] = [
  { label: 'State', placeholder: 'CrashLoopBackOff' },
  { label: 'Code', type: 'number' },
];
const LABEL_COLUMNS: [PairColumn, PairColumn] = [
  { label: 'Label' },
  { label: 'JSONPath', placeholder: '.spec.nodeName', monospace: true },
];

export type KubernetesStateQueryEditorProps = OptionsEditorProps<KubernetesStateQuerySpec>;

export function KubernetesStateQueryEditor(props: KubernetesStateQueryEditorProps): ReactElement {
  const { value, onChange, isReadonly } = props;

  const mappingRows = useMemo<Array<[string, string]>>(
    () => (value.stateMapping ?? DEFAULT_STATE_MAPPING).map((m) => [m.value, String(m.code)]),
    [value.stateMapping],
  );
  const labelRows = useMemo<Array<[string, string]>>(
    () => (value.labelFields ?? []).map((l) => [l.name, l.path]),
    [value.labelFields],
  );

  const handleMapping = useCallback(
    (rows: Array<[string, string]>) =>
      onChange({ ...value, stateMapping: rows.map(([v, c]) => ({ value: v, code: Number(c) || 0 })) }),
    [onChange, value],
  );
  const handleLabels = useCallback(
    (rows: Array<[string, string]>) => {
      const labelFields = rows.map(([name, path]) => ({ name, path }));
      onChange({ ...value, labelFields: labelFields.length > 0 ? labelFields : undefined });
    },
    [onChange, value],
  );
  const handleStateField = useCallback(
    (stateField: string | undefined) => onChange({ ...value, stateField }),
    [onChange, value],
  );
  const resetMapping = useCallback(() => onChange({ ...value, stateMapping: undefined }), [onChange, value]);
  const hasCustomMapping = value.stateMapping !== undefined;
  const resetButton = useMemo(
    () => (hasCustomMapping ? <Button onClick={resetMapping}>Reset to defaults</Button> : undefined),
    [hasCustomMapping, resetMapping],
  );

  return (
    <Stack spacing={2}>
      <ResourceSelectionEditor value={value} onChange={onChange} isReadonly={isReadonly} />
      <OptionalTextField
        label="State field"
        placeholder=".status.phase"
        helperText="JSONPath of the state. Use || for fallbacks, e.g. .status.containerStatuses[*].state.waiting.reason || .status.phase"
        value={value.stateField}
        onChange={handleStateField}
        error={validationError(value.stateField, validateJsonPath)}
        readOnly={isReadonly}
        monospace
      />
      <PairListEditor
        title="State mapping"
        description="The number each state becomes. States not listed become -1."
        rows={mappingRows}
        columns={MAPPING_COLUMNS}
        onChange={handleMapping}
        readOnly={isReadonly}
        actions={resetButton}
      />
      <PairListEditor
        title="Extra labels"
        description="Series labels read from each object, e.g. node = .spec.nodeName"
        rows={labelRows}
        columns={LABEL_COLUMNS}
        onChange={handleLabels}
        readOnly={isReadonly}
      />
    </Stack>
  );
}
