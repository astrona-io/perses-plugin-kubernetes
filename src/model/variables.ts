import type { VariableStateMap } from '@perses-dev/plugin-system';
import { parseVariables, replaceVariables } from '@perses-dev/plugin-system';

const ALL_VALUE = '$__all';
/**
 * Set `customAllValue: "*"` on a namespace variable so "All" means one cluster-wide request. Without it Perses passes
 * every option, and the plugin sends one request per namespace.
 */
export const ALL_NAMESPACES = '*';
const VARIABLE_REF = /\$(\w+)|\$\{(\w+)(?::[^}]+)?\}/g;

/**
 * Resolves a namespace field (a fixed value, `$namespace`, `${namespace}`, or a comma-separated list mixing both)
 * into the namespaces to query.
 *
 * Returns `undefined` for "all namespaces": the field is empty, a referenced variable is set to "All", or it resolves
 * to `*` (a variable's `customAllValue`).
 * A multi-value variable gives one namespace per value; the caller queries each of them.
 */
export function resolveNamespaces(field: string | undefined, state: VariableStateMap): string[] | undefined {
  if (field === undefined || field.trim() === '') {
    return undefined;
  }
  for (const name of parseVariables(field)) {
    const value = state[name]?.value;
    if (value === ALL_VALUE || (Array.isArray(value) && value.includes(ALL_VALUE))) {
      return undefined;
    }
  }
  // Force the csv format so a multi-value variable becomes "a,b" rather than the regex "(a|b)".
  const csv = field.replace(VARIABLE_REF, (_m, a: string | undefined, b: string | undefined) => `\${${a ?? b}:csv}`);
  const resolved = replaceVariables(csv, state);
  const namespaces = [
    ...new Set(
      resolved
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
    ),
  ];
  if (namespaces.length === 0 || namespaces.includes(ALL_NAMESPACES)) {
    return undefined;
  }
  const unresolved = namespaces.find((ns) => ns.includes('$'));
  if (unresolved !== undefined) {
    throw new Error(`namespace "${unresolved}" refers to a variable that has no value`);
  }
  return namespaces;
}

/** Replaces variables in an optional text field; empty stays undefined. */
export function resolveText(field: string | undefined, state: VariableStateMap): string | undefined {
  if (field === undefined || field.trim() === '') {
    return undefined;
  }
  const out = replaceVariables(field, state).trim();
  return out === '' ? undefined : out;
}

/** Every variable referenced by the given fields, for `dependsOn`. */
export function variablesIn(...fields: Array<string | undefined>): string[] {
  const out = new Set<string>();
  for (const f of fields) {
    if (f !== undefined) {
      parseVariables(f).forEach((v) => out.add(v));
    }
  }
  return [...out];
}

/**
 * Resolves a field that may hold several values (a multi-value variable or a comma-separated list).
 * Same rules as `resolveNamespaces`: undefined means "no filter".
 */
export const resolveList = resolveNamespaces;
