import type { TextFieldProps } from '@mui/material';
import { TextField } from '@mui/material';
import type { ChangeEvent, ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

export interface OptionalTextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
  readOnly?: boolean;
  monospace?: boolean;
}

const MONOSPACE = { fontFamily: 'monospace' };

/** Input props for a text field, memoised so editors don't re-render every field on each keystroke. */
export function useInputProps(readOnly?: boolean, monospace?: boolean): TextFieldProps['InputProps'] {
  return useMemo(() => ({ readOnly, sx: monospace ? MONOSPACE : undefined }), [readOnly, monospace]);
}

/** A text field whose empty value is stored as `undefined`, so specs stay minimal. */
export function OptionalTextField(props: OptionalTextFieldProps): ReactElement {
  const { label, value, onChange, placeholder, helperText, error, readOnly, monospace } = props;
  const inputProps = useInputProps(readOnly, monospace);
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value === '' ? undefined : e.target.value),
    [onChange],
  );
  return (
    <TextField
      label={label}
      value={value ?? ''}
      onChange={handleChange}
      placeholder={placeholder}
      helperText={error ?? helperText}
      error={error !== undefined}
      size="small"
      fullWidth
      InputProps={inputProps}
    />
  );
}

/** Returns the error message of `check`, or undefined when it passes or the value is empty. */
export function validationError(value: string | undefined, check: (v: string) => void): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  try {
    check(value);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Throws when `value` is not a valid regular expression. */
export function checkRegex(value: string): void {
  // The RegExp constructor throws a SyntaxError for an invalid pattern.
  const re = new RegExp(value);
  re.test('');
}
