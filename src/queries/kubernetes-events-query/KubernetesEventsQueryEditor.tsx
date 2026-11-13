import { MenuItem, Stack, TextField } from '@mui/material';
import type { DatasourceSelectProps, OptionsEditorProps } from '@perses-dev/plugin-system';
import { DatasourceSelect, isVariableDatasource } from '@perses-dev/plugin-system';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback } from 'react';

import { checkRegex, OptionalTextField, useInputProps, validationError } from '../../components/fields';
import { ROW_ON_WIDE } from '../../components/layout';
import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../../model/constants';
import type { EventType, KubernetesEventsQuerySpec } from './kubernetes-events-query-types';
import { DEFAULT_EVENTS_LIMIT, MAX_EVENTS_LIMIT } from './kubernetes-events-query-types';

export type KubernetesEventsQueryEditorProps = OptionsEditorProps<KubernetesEventsQuerySpec>;

const SELECT_SX = { minWidth: 160 };
const LIMIT_SX = { minWidth: 120 };
const LIMIT_INPUT = { min: 1, max: MAX_EVENTS_LIMIT };

export function KubernetesEventsQueryEditor(props: KubernetesEventsQueryEditorProps): ReactElement {
  const { value, onChange, isReadonly } = props;

  const handleDatasourceChange: DatasourceSelectProps['onChange'] = useCallback(
    (next) => {
      if (!isVariableDatasource(next) && next.kind === DATASOURCE_KIND) {
        onChange({ ...value, datasource: next });
      }
    },
    [onChange, value],
  );
  const setNamespace = useCallback(
    (namespace: string | undefined) => onChange({ ...value, namespace }),
    [onChange, value],
  );
  const setKind = useCallback(
    (involvedObjectKind: string | undefined) => onChange({ ...value, involvedObjectKind }),
    [onChange, value],
  );
  const setName = useCallback(
    (involvedObjectName: string | undefined) => onChange({ ...value, involvedObjectName }),
    [onChange, value],
  );
  const setReason = useCallback((reason: string | undefined) => onChange({ ...value, reason }), [onChange, value]);
  const inputProps = useInputProps(isReadonly);
  const handleType = useCallback(
    (e: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, type: e.target.value === '' ? undefined : (e.target.value as EventType) }),
    [onChange, value],
  );
  const handleLimit = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      onChange({ ...value, limit: e.target.value === '' || !Number.isFinite(n) ? undefined : Math.round(n) });
    },
    [onChange, value],
  );

  return (
    <Stack spacing={2}>
      <DatasourceSelect
        datasourcePluginKind={DATASOURCE_KIND}
        value={value.datasource ?? DEFAULT_DATASOURCE}
        onChange={handleDatasourceChange}
        label="Kubernetes datasource"
        readOnly={isReadonly}
        notched
      />
      <OptionalTextField
        label="Namespace"
        placeholder="all namespaces"
        helperText="A namespace, a variable such as $namespace, or a comma-separated list."
        value={value.namespace}
        onChange={setNamespace}
        readOnly={isReadonly}
      />
      <Stack direction={ROW_ON_WIDE} spacing={2}>
        <OptionalTextField
          label="Object kind"
          placeholder="Pod"
          value={value.involvedObjectKind}
          onChange={setKind}
          readOnly={isReadonly}
        />
        <OptionalTextField
          label="Object name"
          placeholder="$pod"
          value={value.involvedObjectName}
          onChange={setName}
          readOnly={isReadonly}
        />
      </Stack>
      <Stack direction={ROW_ON_WIDE} spacing={2}>
        <TextField
          select
          label="Type"
          value={value.type ?? ''}
          onChange={handleType}
          size="small"
          sx={SELECT_SX}
          InputProps={inputProps}
        >
          <MenuItem value="">Any</MenuItem>
          <MenuItem value="Normal">Normal</MenuItem>
          <MenuItem value="Warning">Warning</MenuItem>
        </TextField>
        <OptionalTextField
          label="Reason"
          placeholder="^(BackOff|Failed)$"
          helperText="Regular expression on the event reason."
          value={value.reason}
          onChange={setReason}
          error={validationError(value.reason, checkRegex)}
          readOnly={isReadonly}
          monospace
        />
        <TextField
          label="Limit"
          type="number"
          value={value.limit ?? ''}
          placeholder={String(DEFAULT_EVENTS_LIMIT)}
          onChange={handleLimit}
          size="small"
          sx={LIMIT_SX}
          inputProps={LIMIT_INPUT}
          InputProps={inputProps}
        />
      </Stack>
    </Stack>
  );
}
