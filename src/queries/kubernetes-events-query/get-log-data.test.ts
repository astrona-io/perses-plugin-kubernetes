import { fakeApi } from '../../test/fakes';
import { eventsFieldSelector, eventsToEntries, eventTimeMs, getLogData } from './get-log-data';
import type { KubernetesEvent } from './kubernetes-events-query-types';

const END = Date.parse('2026-01-01T01:00:00Z');
const START = END - 3600_000;
const iso = (ms: number): string => new Date(ms).toISOString();

const ev = (name: string, at: number, extra: Partial<KubernetesEvent> = {}): KubernetesEvent => ({
  metadata: { name: `${name}.1`, namespace: 'shop' },
  involvedObject: { kind: 'Pod', name, namespace: 'shop' },
  reason: 'BackOff',
  message: 'Back-off restarting failed container',
  type: 'Warning',
  lastTimestamp: iso(at),
  count: 3,
  source: { component: 'kubelet' },
  ...extra,
});

type Ctx = Parameters<typeof getLogData>[1];
const ctx = (store: unknown): Ctx =>
  ({
    datasourceStore: store,
    variableState: {},
    timeRange: { start: new Date(START), end: new Date(END) },
  }) as unknown as Ctx;
const all = { startMs: START, endMs: END, limit: 1000 };

describe('eventTimeMs', () => {
  it('prefers the latest observation and falls back to older fields', () => {
    expect(
      eventTimeMs({
        series: { lastObservedTime: iso(5), count: 2 },
        lastTimestamp: iso(1),
      }),
    ).toBe(5);
    expect(eventTimeMs({ eventTime: iso(7) })).toBe(7);
    expect(eventTimeMs({ metadata: { creationTimestamp: iso(9) } })).toBe(9);
    expect(eventTimeMs({ lastTimestamp: 'not a date' })).toBeUndefined();
    expect(eventTimeMs({})).toBeUndefined();
  });
});

describe('eventsFieldSelector', () => {
  it('sends single values to the server and keeps multi-values client-side', () => {
    expect(eventsFieldSelector()).toBeUndefined();
    expect(eventsFieldSelector(['Pod'], ['web'], 'Warning')).toBe(
      'involvedObject.kind=Pod,involvedObject.name=web,type=Warning',
    );
    expect(eventsFieldSelector(['Pod', 'Node'], ['a', 'b'])).toBeUndefined();
  });
});

describe('eventsToEntries', () => {
  it('is empty for no events', () => {
    expect(eventsToEntries([], all)).toEqual({ entries: [], total: 0 });
  });

  it('turns events into log entries, newest first', () => {
    const { entries } = eventsToEntries(
      [
        ev('old', START + 1000),
        ev('new', END - 1000, {
          type: 'Normal',
          reason: 'Pulled',
          message: ' ok ',
        }),
      ],
      all,
    );
    expect(entries.map((e) => e.labels.object)).toEqual(['new', 'old']);
    expect(entries[0]).toEqual({
      timestamp: (END - 1000) / 1000,
      line: 'Pulled: ok',
      labels: {
        level: 'info',
        type: 'Normal',
        reason: 'Pulled',
        namespace: 'shop',
        kind: 'Pod',
        object: 'new',
        count: '3',
        source: 'kubelet',
      },
    });
    expect(entries[1]?.labels.level).toBe('warning');
  });

  it('drops events outside the time range and without a time', () => {
    const { total } = eventsToEntries([ev('a', START - 1), ev('b', END + 1), { reason: 'X' }, ev('c', START)], all);
    expect(total).toBe(1);
  });

  it('filters on kind, name, type and reason', () => {
    const events = [
      ev('a', START + 1),
      ev('b', START + 2, { reason: 'Failed' }),
      ev('c', START + 3, { involvedObject: { kind: 'Node', name: 'c' } }),
    ];
    expect(eventsToEntries(events, { ...all, kinds: ['Pod'] }).total).toBe(2);
    expect(eventsToEntries(events, { ...all, names: ['a', 'c'] }).total).toBe(2);
    expect(eventsToEntries(events, { ...all, type: 'Normal' }).total).toBe(0);
    expect(eventsToEntries(events, { ...all, reason: /^Fail/ }).total).toBe(1);
  });

  it('limits a large result but reports the total', () => {
    const events = Array.from({ length: 5000 }, (_, i) => ev(`p${i}`, START + i));
    const { entries, total } = eventsToEntries(events, { ...all, limit: 100 });
    expect(entries).toHaveLength(100);
    expect(total).toBe(5000);
    expect(entries[0]?.labels.object).toBe('p4999');
  });
});

describe('getLogData', () => {
  it('lists events with a server-side field selector', async () => {
    const { store, requests } = fakeApi({
      '/api/v1/namespaces/shop/events': [ev('web', END - 10)],
    });
    const result = await getLogData({ namespace: 'shop', involvedObjectKind: 'Pod', type: 'Warning' }, ctx(store));
    expect(result.logs.entries).toHaveLength(1);
    expect(result.logs.hasMore).toBe(false);
    expect(requests[0]?.url.searchParams.get('fieldSelector')).toBe('involvedObject.kind=Pod,type=Warning');
    expect(result.metadata?.executedQueryString).toBe('/api/v1/namespaces/shop/events');
  });

  it('says there is more when the limit cuts the result', async () => {
    const { store } = fakeApi({
      '/api/v1/events': [ev('a', END - 1), ev('b', END - 2)],
    });
    const result = await getLogData({ limit: 1 }, ctx(store));
    expect(result.logs.entries).toHaveLength(1);
    expect(result.logs.hasMore).toBe(true);
  });

  it('surfaces API errors', async () => {
    const { store } = fakeApi({});
    await expect(getLogData({}, ctx(store))).rejects.toThrow('not found');
  });
});
