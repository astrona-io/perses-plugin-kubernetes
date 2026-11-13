import type { ResourceSelection } from '../../components/common-spec';

export interface KubernetesResourceVariableSpec extends ResourceSelection {
  /** JSONPath of the option value; default `.metadata.name`. */
  valueField?: string;
  /** JSONPath of the option label; default: the value. */
  labelField?: string;
  /** Regular expression the value must match to be kept. */
  filter?: string;
}

export const DEFAULT_VALUE_FIELD = '.metadata.name';
