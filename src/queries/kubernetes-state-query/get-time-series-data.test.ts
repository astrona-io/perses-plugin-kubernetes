import { fakeApi, pod, vars } from '../../test/fakes';
import { getTimeSeriesData, objectsToSeries } from './get-time-series-data';

const AT = Date.parse('2026-01-01T00:00:00Z');
type Ctx = Parameters<typeof getTimeSeriesData>[1];
const ctx = (store: unknown, variableState = {}): Ctx =>
  ({
    datasourceStore: store,
    variableState,
    timeRange: { start: new Date(AT - 3600_000), end: new Date(AT) },
  }) as unknown as Ctx;

describe('objectsToSeries', () => {
  it('is empty for no objects', () => {
    expect(objectsToSeries([], { resource: 'pods' }, 'Pod', AT)).toEqual([]);
  });

  it('maps the default state field with the default mapping', () => {
    const series = objectsToSeries(
      [
        pod('a', 'ok'),
        pod('a', 'wait', { phase: 'Pending' }),
        pod('a', 'bad', { phase: 'Failed' }),
        pod('a', 'odd', { phase: 'Weird' }),
      ],
      { resource: 'pods' },
      'Pod',
      AT,
    );
    expect(series.map((s) => [s.name, s.values[0]?.[1], s.labels?.state])).toEqual([
      ['a/bad', 2, 'Failed'],
      ['a/odd', -1, 'Weird'],
      ['a/ok', 0, 'Running'],
      ['a/wait', 1, 'Pending'],
    ]);
    expect(series[0]?.values[0]?.[0]).toBe(AT);
    expect(series[0]?.labels).toMatchObject({
      name: 'bad',
      namespace: 'a',
      kind: 'Pod',
    });
  });

  it('uses a custom state field, mapping and extra labels', () => {
    const series = objectsToSeries(
      [pod('a', 'crash', { waiting: 'CrashLoopBackOff', node: 'n2' })],
      {
        resource: 'pods',
        stateField: '.status.containerStatuses[*].state.waiting.reason || .status.phase',
        stateMapping: [{ value: 'CrashLoopBackOff', code: 9 }],
        labelFields: [{ name: 'node', path: '.spec.nodeName' }],
      },
      'Pod',
      AT,
    );
    expect(series[0]?.values[0]?.[1]).toBe(9);
    expect(series[0]?.labels).toMatchObject({
      state: 'CrashLoopBackOff',
      node: 'n2',
    });
  });

  it('has no namespace label for cluster-scoped objects and Unknown for a missing state', () => {
    const [s] = objectsToSeries([{ metadata: { name: 'node-1' } }], { resource: 'nodes' }, 'Node', AT);
    expect(s?.name).toBe('node-1');
    expect(s?.labels?.namespace).toBeUndefined();
    expect(s?.labels?.state).toBe('Unknown');
    expect(s?.values[0]?.[1]).toBe(2);
  });

  it('handles a large list', () => {
    const objs = Array.from({ length: 5000 }, (_, i) => pod('ns', `p${i}`));
    expect(objectsToSeries(objs, { resource: 'pods' }, 'Pod', AT)).toHaveLength(5000);
  });
});

describe('getTimeSeriesData', () => {
  it('queries per namespace and reports the paths', async () => {
    const { store } = fakeApi({ '/api/v1/namespaces/a/pods': [pod('a', 'x')] });
    const result = await getTimeSeriesData({ resource: 'pods', namespace: '$ns' }, ctx(store, vars({ ns: 'a' })));
    expect(result.series).toHaveLength(1);
    expect(result.metadata?.executedQueryString).toBe('/api/v1/namespaces/a/pods');
    expect(result.metadata?.notices).toEqual([]);
  });

  it('warns when the result is truncated', async () => {
    const { store } = fakeApi({
      '/api/v1/pods': Array.from({ length: 5001 }, (_, i) => pod('a', `p${i}`)),
    });
    const result = await getTimeSeriesData({ resource: 'pods' }, ctx(store));
    expect(result.series).toHaveLength(5000);
    expect(result.metadata?.notices?.[0]?.type).toBe('warning');
  });

  it('surfaces API errors', async () => {
    const { store } = fakeApi({});
    await expect(getTimeSeriesData({ resource: 'pods' }, ctx(store))).rejects.toThrow('not found');
  });
});
