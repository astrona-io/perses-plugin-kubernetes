import type { ResourceSelection } from '../../components/common-spec';

export interface StateMappingEntry {
  /** A state, exactly as the API returns it (e.g. `CrashLoopBackOff`). */
  value: string;
  /** The number the series carries for that state. */
  code: number;
}

export interface LabelField {
  /** Label name on the series. */
  name: string;
  /** JSONPath of the label value. */
  path: string;
}

export interface KubernetesStateQuerySpec extends ResourceSelection {
  /** JSONPath of the state; `||` gives fallbacks. Default `.status.phase`. */
  stateField?: string;
  /** State to number. Default: DEFAULT_STATE_MAPPING. Unmapped states get UNMAPPED_CODE. */
  stateMapping?: StateMappingEntry[];
  /** Extra series labels read from each object. */
  labelFields?: LabelField[];
}

export const DEFAULT_STATE_FIELD = '.status.phase';
export const UNMAPPED_CODE = -1;

/** 0 is fine, 1 is in progress or degraded, 2 is broken. */
export const DEFAULT_STATE_MAPPING: StateMappingEntry[] = [
  { value: 'Running', code: 0 },
  { value: 'Succeeded', code: 0 },
  { value: 'Active', code: 0 },
  { value: 'True', code: 0 },
  { value: 'Ready', code: 0 },
  { value: 'Pending', code: 1 },
  { value: 'ContainerCreating', code: 1 },
  { value: 'PodInitializing', code: 1 },
  { value: 'Terminating', code: 1 },
  { value: 'False', code: 2 },
  { value: 'Failed', code: 2 },
  { value: 'Unknown', code: 2 },
  { value: 'CrashLoopBackOff', code: 2 },
  { value: 'ImagePullBackOff', code: 2 },
  { value: 'ErrImagePull', code: 2 },
  { value: 'CreateContainerConfigError', code: 2 },
  { value: 'OOMKilled', code: 2 },
  { value: 'Error', code: 2 },
];
