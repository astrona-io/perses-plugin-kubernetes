import { evaluateJsonPath, selectAll, selectFirst, validateJsonPath } from './jsonpath';

const obj = {
  metadata: { name: 'web-1', labels: { 'app.kubernetes.io/name': 'web' } },
  spec: { containers: [{ image: 'nginx:1' }, { image: 'sidecar:2' }] },
  status: {
    phase: 'Running',
    conditions: [
      { type: 'Ready', status: 'True' },
      { type: 'Available', status: 'False' },
    ],
  },
};

describe('jsonpath', () => {
  it('reads fields, braces, $ and quoted keys', () => {
    expect(selectFirst(obj, '.metadata.name')).toBe('web-1');
    expect(selectFirst(obj, '{.metadata.name}')).toBe('web-1');
    expect(selectFirst(obj, '$.status.phase')).toBe('Running');
    expect(selectFirst(obj, ".metadata.labels['app.kubernetes.io/name']")).toBe('web');
    expect(selectFirst(obj, '.metadata.labels["app.kubernetes.io/name"]')).toBe('web');
  });

  it('indexes, wildcards and filters', () => {
    expect(selectFirst(obj, '.spec.containers[0].image')).toBe('nginx:1');
    expect(selectFirst(obj, '.spec.containers[-1].image')).toBe('sidecar:2');
    expect(selectAll(obj, '.spec.containers[*].image')).toEqual(['nginx:1', 'sidecar:2']);
    expect(selectFirst(obj, '.status.conditions[?(@.type=="Ready")].status')).toBe('True');
    expect(selectAll(obj, ".status.conditions[?(@.type!='Ready')].type")).toEqual(['Available']);
  });

  it('falls back with ||', () => {
    expect(selectFirst(obj, '.status.reason || .status.phase')).toBe('Running');
    expect(selectFirst(obj, '.nothing || .also.nothing')).toBeUndefined();
  });

  it('returns nothing for missing paths and non-objects', () => {
    expect(evaluateJsonPath(obj, '.spec.missing.deeper')).toEqual([]);
    expect(evaluateJsonPath(null, '.a')).toEqual([]);
    expect(evaluateJsonPath(obj, '.spec.containers[9]')).toEqual([]);
  });

  it('stringifies non-string values', () => {
    expect(selectFirst({ a: 3 }, '.a')).toBe('3');
    expect(selectFirst({ a: true }, '.a')).toBe('true');
    expect(selectFirst({ a: { b: 1 } }, '.a')).toBe('{"b":1}');
  });

  it('rejects syntax it does not support', () => {
    expect(() => validateJsonPath('')).toThrow('empty JSONPath');
    expect(() => validateJsonPath('metadata.name')).toThrow('paths start with "."');
    expect(() => validateJsonPath('.a[?(@.x > 1)]')).toThrow('unsupported filter');
    expect(() => validateJsonPath(".a['open")).toThrow('unterminated');
    expect(() => validateJsonPath('.a[x]')).toThrow('unsupported bracket');
    expect(() => validateJsonPath('.a || .b')).not.toThrow();
  });
});
