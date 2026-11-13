import { Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';
import { memo, useCallback } from 'react';

import { useInputProps } from './fields';

export interface PairColumn {
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
  monospace?: boolean;
}

export type PairRow = [string, string];

export interface PairListEditorProps {
  title: string;
  description?: string;
  rows: PairRow[];
  columns: [PairColumn, PairColumn];
  onChange: (rows: PairRow[]) => void;
  readOnly?: boolean;
  /** Extra buttons, e.g. "Reset to defaults". */
  actions?: ReactNode;
}

const NUMBER_SX = { maxWidth: 120 };

interface CellProps {
  column: PairColumn;
  value: string;
  row: number;
  col: 0 | 1;
  readOnly?: boolean;
  onCell: (row: number, col: 0 | 1, value: string) => void;
}

const Cell = memo(function Cell({ column, value, row, col, readOnly, onCell }: CellProps): ReactElement {
  const inputProps = useInputProps(readOnly, column.monospace);
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onCell(row, col, e.target.value),
    [onCell, row, col],
  );
  const isNumber = column.type === 'number';
  return (
    <TextField
      label={column.label}
      placeholder={column.placeholder}
      type={column.type ?? 'text'}
      value={value}
      onChange={handleChange}
      size="small"
      fullWidth={!isNumber}
      sx={isNumber ? NUMBER_SX : undefined}
      InputProps={inputProps}
    />
  );
});

interface RemoveProps {
  row: number;
  title: string;
  onRemove: (row: number) => void;
}

const RemoveButton = memo(function RemoveButton({ row, title, onRemove }: RemoveProps): ReactElement {
  const handleClick = useCallback(() => onRemove(row), [onRemove, row]);
  return (
    <IconButton aria-label={`Remove row ${row + 1} of ${title}`} onClick={handleClick}>
      <span aria-hidden="true">×</span>
    </IconButton>
  );
});

/** An editable list of two-column rows (state and code, label and JSONPath). */
export function PairListEditor(props: PairListEditorProps): ReactElement {
  const { title, description, rows, columns, onChange, readOnly, actions } = props;
  const handleCell = useCallback(
    (row: number, col: 0 | 1, value: string) => {
      onChange(
        rows.map((r, i): PairRow => {
          if (i !== row) return r;
          return col === 0 ? [value, r[1]] : [r[0], value];
        }),
      );
    },
    [onChange, rows],
  );
  const handleRemove = useCallback((row: number) => onChange(rows.filter((_, j) => j !== row)), [onChange, rows]);
  const handleAdd = useCallback(
    () => onChange([...rows, ['', columns[1].type === 'number' ? '0' : '']]),
    [onChange, rows, columns],
  );
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" component="h3">
        {title}
      </Typography>
      {description !== undefined && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
      {rows.map((row, i) => (
        <Stack
          // Rows have no identity of their own; the index is the identity while editing.
          // oxlint-disable-next-line react/no-array-index-key
          key={i}
          direction="row"
          spacing={1}
          alignItems="center"
        >
          <Cell column={columns[0]} value={row[0]} row={i} col={0} readOnly={readOnly} onCell={handleCell} />
          <Cell column={columns[1]} value={row[1]} row={i} col={1} readOnly={readOnly} onCell={handleCell} />
          {!readOnly && <RemoveButton row={i} title={title} onRemove={handleRemove} />}
        </Stack>
      ))}
      {!readOnly && (
        <Stack direction="row" spacing={1}>
          <Button onClick={handleAdd}>Add</Button>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}
