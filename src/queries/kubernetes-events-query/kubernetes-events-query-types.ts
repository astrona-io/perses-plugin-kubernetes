import type { DatasourceSelector } from '@perses-dev/spec';

export type EventType = 'Normal' | 'Warning';

export interface KubernetesEventsQuerySpec {
  datasource?: DatasourceSelector;
  /** A namespace, `$variable`, or a comma-separated list; empty means all namespaces. */
  namespace?: string;
  /** Kind of the object the event is about, e.g. `Pod`. */
  involvedObjectKind?: string;
  /** Name of the object the event is about; a multi-value variable is allowed. */
  involvedObjectName?: string;
  type?: EventType;
  /** Regular expression on the event reason, e.g. `^(BackOff|Failed)$`. */
  reason?: string;
  /** Most recent events to keep; default 1000. */
  limit?: number;
}

export const DEFAULT_EVENTS_LIMIT = 1000;
export const MAX_EVENTS_LIMIT = 5000;

/** The fields of a core/v1 Event this plugin reads. */
export interface KubernetesEvent {
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string };
  involvedObject?: { kind?: string; name?: string; namespace?: string };
  reason?: string;
  message?: string;
  type?: string;
  count?: number;
  firstTimestamp?: string | null;
  lastTimestamp?: string | null;
  eventTime?: string | null;
  source?: { component?: string; host?: string };
  reportingComponent?: string;
  series?: { count?: number; lastObservedTime?: string };
}
