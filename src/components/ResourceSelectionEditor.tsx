import { MenuItem, Stack, TextField } from '@mui/material';
import type { DatasourceSelectProps } from '@perses-dev/plugin-system';
import { DatasourceSelect, isVariableDatasource } from '@perses-dev/plugin-system';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback } from 'react';

import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../model/constants';
import type { ResourceName } from '../model/resources';
import { BUILTIN_RESOURCES, parseCustomResource } from '../model/resources';
import type { ResourceSelection } from './common-spec';
import { OptionalTextField, useInputProps, validationError } from './fields';
import { ROW_ON_WIDE } from './layout';

export interface ResourceSelectionEditorProps<T extends ResourceSelection> {
  value: T;
  onChange: (next: T) => void;
  isReadonly?: boolean;
  /** The events query reads one resource only, so it hides the resource picker. */
  hideResource?: boolean;
}

const RESOURCE_OPTIONS: Array<{ value: ResourceName; label: string }> = [
  ...BUILTIN_RESOURCES.map((r) => ({ value: r as ResourceName, label: r })),
  { value: 'custom', label: 'custom (group/version/resource)' },
];

/** Datasource, resource, namespace and selectors: the fields the variable and the queries share. */
export function ResourceSelectionEditor<T extends ResourceSelection>(
  props: ResourceSelectionEditorProps<T>,
): ReactElement {
  const { value, onChange, isReadonly, hideResource } = props;

  const handleDatasourceChange: DatasourceSelectProps['onChange'] = useCallback(
    (next) => {
      if (!isVariableDatasource(next) && next.kind === DATASOURCE_KIND) {
        onChange({ ...value, datasource: next });
      }
    },
    [onChange, value],
  );

  const handleResourceChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const resource = e.target.value as ResourceName;
      onChange({ ...value, resource, customResource: resource === 'custom' ? value.customResource : undefined });
    },
    [onChange, value],
  );

  const setCustomResource = useCallback(
    (customResource: string | undefined) => onChange({ ...value, customResource }),
    [onChange, value],
  );
  const setNamespace = useCallback(
    (namespace: string | undefined) => onChange({ ...value, namespace }),
    [onChange, value],
  );
  const setLabelSelector = useCallback(
    (labelSelector: string | undefined) => onChange({ ...value, labelSelector }),
    [onChange, value],
  );
  const setFieldSelector = useCallback(
    (fieldSelector: string | undefined) => onChange({ ...value, fieldSelector }),
    [onChange, value],
  );
  const selectInputProps = useInputProps(isReadonly);

  const clusterScoped = value.resource === 'namespaces' || value.resource === 'nodes';

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
      {!hideResource && (
        <TextField
          select
          label="Resource"
          value={value.resource}
          onChange={handleResourceChange}
          size="small"
          InputProps={selectInputProps}
        >
          {RESOURCE_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
      {!hideResource && value.resource === 'custom' && (
        <OptionalTextField
          label="Custom resource"
          placeholder="example.com/v1/widgets"
          helperText="group/version/resource (plural). The datasource allow-list needs a pattern for it."
          value={value.customResource}
          onChange={setCustomResource}
          error={validationError(value.customResource, (v) => parseCustomResource(v))}
          readOnly={isReadonly}
          monospace
        />
      )}
      {!clusterScoped && (
        <OptionalTextField
          label="Namespace"
          placeholder="all namespaces"
          helperText="A namespace, a variable such as $namespace, or a comma-separated list. Empty: all namespaces."
          value={value.namespace}
          onChange={setNamespace}
          readOnly={isReadonly}
        />
      )}
      <Stack direction={ROW_ON_WIDE} spacing={2}>
        <OptionalTextField
          label="Label selector"
          placeholder="app=web,tier!=cache"
          value={value.labelSelector}
          onChange={setLabelSelector}
          readOnly={isReadonly}
          monospace
        />
        <OptionalTextField
          label="Field selector"
          placeholder="status.phase!=Running"
          value={value.fieldSelector}
          onChange={setFieldSelector}
          readOnly={isReadonly}
          monospace
        />
      </Stack>
    </Stack>
  );
}
