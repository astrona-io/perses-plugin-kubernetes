// A small JSONPath evaluator for the subset kubectl users write every day:
//
//   .metadata.name                          field access
//   {.metadata.name}                        kubectl-style braces (stripped)
//   .metadata.labels['app.kubernetes.io/name']   quoted keys (single or double quotes)
//   .spec.containers[0].image               array index (negative counts from the end)
//   .spec.containers[*].image               wildcard over an array or an object
//   .status.conditions[?(@.type=="Ready")].status   equality / inequality filter
//
// Several paths can be chained with `||`: the first one that yields a non-empty value wins,
// e.g. `.status.containerStatuses[*].state.waiting.reason || .status.phase`.
// Anything else is a syntax error, reported to the user rather than silently ignored.

type Segment =
  | { type: 'key'; key: string }
  | { type: 'index'; index: number }
  | { type: 'wildcard' }
  | { type: 'filter'; path: string[]; op: '==' | '!='; value: string };

const cache = new Map<string, Segment[]>();

function parseQuoted(input: string, start: number): [string, number] {
  const quote = input[start];
  let i = start + 1;
  let out = '';
  while (i < input.length && input[i] !== quote) {
    if (input[i] === '\\' && i + 1 < input.length) {
      i++;
    }
    out += input[i];
    i++;
  }
  if (i >= input.length) {
    throw new Error(`unterminated string in JSONPath "${input}"`);
  }
  return [out, i + 1];
}

function parseFilter(body: string, full: string): Segment {
  // body is the text between `[?(` and `)]`, e.g. `@.type=="Ready"`
  const match = /^@((?:\.[A-Za-z0-9_-]+)+)\s*(==|!=)\s*(?:"([^"]*)"|'([^']*)'|([A-Za-z0-9_.-]+))$/.exec(body.trim());
  if (match === null) {
    throw new Error(`unsupported filter in JSONPath "${full}": only [?(@.field=="value")] and != are supported`);
  }
  const [, fieldPath = '', op, dq, sq, bare] = match;
  return {
    type: 'filter',
    path: fieldPath.split('.').filter((p) => p !== ''),
    op: op as '==' | '!=',
    value: dq ?? sq ?? bare ?? '',
  };
}

export function parseJsonPath(expression: string): Segment[] {
  const cached = cache.get(expression);
  if (cached !== undefined) {
    return cached;
  }
  let input = expression.trim();
  if (input.startsWith('{') && input.endsWith('}')) {
    input = input.slice(1, -1).trim();
  }
  if (input.startsWith('$')) {
    input = input.slice(1);
  }
  if (input === '' || input === '.') {
    throw new Error('empty JSONPath');
  }
  const segments: Segment[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === '.') {
      i++;
      const start = i;
      while (i < input.length && /[A-Za-z0-9_-]/.test(input[i] ?? '')) {
        i++;
      }
      if (i === start) {
        throw new Error(`invalid JSONPath "${expression}" at position ${start}`);
      }
      segments.push({ type: 'key', key: input.slice(start, i) });
    } else if (c === '[') {
      const next = input[i + 1];
      if (next === "'" || next === '"') {
        const [key, end] = parseQuoted(input, i + 1);
        if (input[end] !== ']') {
          throw new Error(`invalid JSONPath "${expression}": expected ] after quoted key`);
        }
        segments.push({ type: 'key', key });
        i = end + 1;
      } else if (next === '*') {
        if (input[i + 2] !== ']') {
          throw new Error(`invalid JSONPath "${expression}": expected ] after *`);
        }
        segments.push({ type: 'wildcard' });
        i += 3;
      } else if (next === '?') {
        const end = input.indexOf(')]', i);
        if (input[i + 2] !== '(' || end === -1) {
          throw new Error(`invalid JSONPath "${expression}": filters are written [?(...)]`);
        }
        segments.push(parseFilter(input.slice(i + 3, end), expression));
        i = end + 2;
      } else {
        const end = input.indexOf(']', i);
        const index = Number(input.slice(i + 1, end));
        if (end === -1 || !Number.isInteger(index)) {
          throw new Error(`invalid JSONPath "${expression}": unsupported bracket expression`);
        }
        segments.push({ type: 'index', index });
        i = end + 1;
      }
    } else {
      throw new Error(`invalid JSONPath "${expression}": paths start with "." (e.g. .metadata.name)`);
    }
  }
  cache.set(expression, segments);
  return segments;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getPath(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (!isRecord(cur)) {
      return undefined;
    }
    cur = cur[key];
  }
  return cur;
}

function step(values: unknown[], segment: Segment): unknown[] {
  const out: unknown[] = [];
  for (const v of values) {
    switch (segment.type) {
      case 'key':
        if (isRecord(v) && segment.key in v) {
          out.push(v[segment.key]);
        }
        break;
      case 'index':
        if (Array.isArray(v)) {
          const idx = segment.index < 0 ? v.length + segment.index : segment.index;
          if (idx >= 0 && idx < v.length) {
            out.push(v[idx]);
          }
        }
        break;
      case 'wildcard':
        if (Array.isArray(v)) {
          out.push(...v);
        } else if (isRecord(v)) {
          out.push(...Object.values(v));
        }
        break;
      case 'filter':
        if (Array.isArray(v)) {
          for (const item of v) {
            const field = getPath(item, segment.path);
            const equal = field !== undefined && field !== null && String(field) === segment.value;
            if ((segment.op === '==') === equal) {
              out.push(item);
            }
          }
        }
        break;
    }
  }
  return out;
}

/** Evaluates one path (no `||`) and returns every matching value, in document order. */
export function evaluateJsonPath(obj: unknown, expression: string): unknown[] {
  let values: unknown[] = [obj];
  for (const segment of parseJsonPath(expression)) {
    values = step(values, segment);
    if (values.length === 0) {
      return values;
    }
  }
  return values.filter((v) => v !== undefined && v !== null);
}

export function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/** Splits `a || b || c` into its alternatives. */
export function alternatives(expression: string): string[] {
  return expression
    .split('||')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/**
 * Returns every value of the first alternative that yields at least one non-empty value,
 * as strings (objects and arrays are JSON-encoded).
 */
export function selectAll(obj: unknown, expression: string): string[] {
  for (const alt of alternatives(expression)) {
    const values = evaluateJsonPath(obj, alt)
      .map(stringify)
      .filter((s) => s !== '');
    if (values.length > 0) {
      return values;
    }
  }
  return [];
}

/** Returns the first value of `selectAll`, or undefined when nothing matches. */
export function selectFirst(obj: unknown, expression: string): string | undefined {
  return selectAll(obj, expression)[0];
}

/** Throws a readable error when an expression can't be parsed. Used by the editors and schemas tests. */
export function validateJsonPath(expression: string): void {
  const alts = alternatives(expression);
  if (alts.length === 0) {
    throw new Error('empty JSONPath');
  }
  alts.forEach(parseJsonPath);
}
