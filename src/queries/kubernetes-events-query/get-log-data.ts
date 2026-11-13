import type { LogQueryPlugin } from '@perses-dev/plugin-system';
import type { LogEntry } from '@perses-dev/spec';

import { getClient, listObjects } from '../../model/query';
import { EVENTS } from '../../model/resources';
import { resolveList, resolveNamespaces, resolveText } from '../../model/variables';
import type { KubernetesEvent, KubernetesEventsQuerySpec } from './kubernetes-events-query-types';
import { DEFAULT_EVENTS_LIMIT, MAX_EVENTS_LIMIT } from './kubernetes-events-query-types';

/** When the event last happened, in milliseconds, or undefined when it carries no usable time. */
export function eventTimeMs(e: KubernetesEvent): number | undefined {
  const candidates = [
    e.series?.lastObservedTime,
    e.lastTimestamp,
    e.eventTime,
    e.firstTimestamp,
    e.metadata?.creationTimestamp,
  ];
  for (const c of candidates) {
    if (c) {
      const ms = Date.parse(c);
      if (!Number.isNaN(ms)) {
        return ms;
      }
    }
  }
  return undefined;
}

/** Builds the server-side field selector; a filter with several values is applied client-side instead. */
export function eventsFieldSelector(kinds?: string[], names?: string[], type?: string): string | undefined {
  const parts: string[] = [];
  if (kinds?.length === 1) parts.push(`involvedObject.kind=${kinds[0]}`);
  if (names?.length === 1) parts.push(`involvedObject.name=${names[0]}`);
  if (type) parts.push(`type=${type}`);
  return parts.length > 0 ? parts.join(',') : undefined;
}

export interface EventFilter {
  kinds?: string[];
  names?: string[];
  type?: string;
  reason?: RegExp;
  startMs: number;
  endMs: number;
  limit: number;
}

/** Filters events to the time range and the filters, newest first, and turns them into log entries. */
export function eventsToEntries(
  events: KubernetesEvent[],
  filter: EventFilter,
): { entries: LogEntry[]; total: number } {
  const kept: Array<{ ms: number; e: KubernetesEvent }> = [];
  for (const e of events) {
    const ms = eventTimeMs(e);
    if (ms === undefined || ms < filter.startMs || ms > filter.endMs) continue;
    if (filter.kinds && !filter.kinds.includes(e.involvedObject?.kind ?? '')) continue;
    if (filter.names && !filter.names.includes(e.involvedObject?.name ?? '')) continue;
    if (filter.type && e.type !== filter.type) continue;
    if (filter.reason && !filter.reason.test(e.reason ?? '')) continue;
    kept.push({ ms, e });
  }
  kept.sort((a, b) => b.ms - a.ms);
  const entries = kept.slice(0, filter.limit).map(({ ms, e }): LogEntry => {
    const reason = e.reason ?? '';
    const message = (e.message ?? '').trim();
    const labels: Record<string, string> = {
      level: e.type === 'Warning' ? 'warning' : 'info',
      type: e.type ?? '',
      reason,
      namespace: e.involvedObject?.namespace ?? e.metadata?.namespace ?? '',
      kind: e.involvedObject?.kind ?? '',
      object: e.involvedObject?.name ?? '',
      count: String(e.series?.count ?? e.count ?? 1),
      source: e.reportingComponent || e.source?.component || '',
    };
    for (const k of Object.keys(labels)) {
      if (labels[k] === '') delete labels[k];
    }
    return { timestamp: ms / 1000, line: reason !== '' ? `${reason}: ${message}` : message, labels };
  });
  return { entries, total: kept.length };
}

export const getLogData: LogQueryPlugin<KubernetesEventsQuerySpec>['getLogData'] = async (spec, ctx, abortSignal) => {
  const vars = ctx.variableState;
  const kinds = resolveList(spec.involvedObjectKind, vars);
  const names = resolveList(spec.involvedObjectName, vars);
  const reasonText = resolveText(spec.reason, vars);
  const limit = Math.min(Math.max(spec.limit ?? DEFAULT_EVENTS_LIMIT, 1), MAX_EVENTS_LIMIT);
  const client = await getClient(ctx.datasourceStore, spec.datasource);
  const { items, truncated, paths } = await listObjects<KubernetesEvent>(client, {
    ref: EVENTS,
    namespaces: resolveNamespaces(spec.namespace, vars),
    fieldSelector: eventsFieldSelector(kinds, names, spec.type),
    maxItems: MAX_EVENTS_LIMIT,
    signal: abortSignal,
  });
  const { start, end } = ctx.timeRange;
  const { entries, total } = eventsToEntries(items, {
    kinds,
    names,
    type: spec.type,
    reason: reasonText !== undefined ? new RegExp(reasonText) : undefined,
    startMs: start.getTime(),
    endMs: end.getTime(),
    limit,
  });
  return {
    logs: {
      entries,
      totalCount: total,
      hasMore: truncated || total > entries.length,
      direction: 'backward',
      timeRange: { start, end },
    },
    timeRange: { start, end },
    metadata: { executedQueryString: paths.join('\n') },
  };
};
