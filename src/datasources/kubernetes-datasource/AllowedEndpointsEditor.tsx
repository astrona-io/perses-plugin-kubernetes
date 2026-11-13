import { Button, IconButton, Stack, TextField } from '@mui/material';
import type { HTTPAllowedEndpoint } from '@perses-dev/spec';
import type { ChangeEvent, ReactElement } from 'react';
import { memo, useCallback } from 'react';

import { useInputProps } from '../../components/fields';
import { DEFAULT_ALLOWED_ENDPOINTS } from './allowed-endpoints';

export interface AllowedEndpointsEditorProps {
  endpoints: HTTPAllowedEndpoint[];
  onChange: (next: HTTPAllowedEndpoint[]) => void;
  isReadonly?: boolean;
}

interface RowProps {
  index: number;
  pattern: string;
  isReadonly?: boolean;
  onPattern: (index: number, pattern: string) => void;
  onRemove: (index: number) => void;
}

const EndpointRow = memo(function EndpointRow(props: RowProps): ReactElement {
  const { index, pattern, isReadonly, onPattern, onRemove } = props;
  const inputProps = useInputProps(isReadonly, true);
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onPattern(index, e.target.value),
    [onPattern, index],
  );
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        label={`Pattern ${index + 1}`}
        value={pattern}
        onChange={handleChange}
        InputProps={inputProps}
        fullWidth
        size="small"
      />
      {!isReadonly && (
        <IconButton aria-label={`Remove pattern ${index + 1}`} onClick={handleRemove}>
          <span aria-hidden="true">×</span>
        </IconButton>
      )}
    </Stack>
  );
});

/** Edits the proxy allow-list. Every entry is GET: the method is not editable. */
export function AllowedEndpointsEditor(props: AllowedEndpointsEditorProps): ReactElement {
  const { endpoints, onChange, isReadonly } = props;
  const handlePattern = useCallback(
    (index: number, endpointPattern: string) =>
      onChange(endpoints.map((e, i): HTTPAllowedEndpoint => (i === index ? { endpointPattern, method: 'GET' } : e))),
    [endpoints, onChange],
  );
  const handleRemove = useCallback(
    (index: number) => onChange(endpoints.filter((_, i) => i !== index)),
    [endpoints, onChange],
  );
  const handleAdd = useCallback(
    () => onChange([...endpoints, { endpointPattern: '^$', method: 'GET' }]),
    [endpoints, onChange],
  );
  const handleReset = useCallback(() => onChange(structuredClone(DEFAULT_ALLOWED_ENDPOINTS)), [onChange]);
  return (
    <Stack spacing={1}>
      {endpoints.map((e, i) => (
        <EndpointRow
          // Entries have no identity besides their position.
          // oxlint-disable-next-line react/no-array-index-key
          key={i}
          index={i}
          pattern={e.endpointPattern}
          isReadonly={isReadonly}
          onPattern={handlePattern}
          onRemove={handleRemove}
        />
      ))}
      {!isReadonly && (
        <Stack direction="row" spacing={1}>
          <Button onClick={handleAdd}>Add pattern</Button>
          <Button onClick={handleReset}>Reset to defaults</Button>
        </Stack>
      )}
    </Stack>
  );
}
