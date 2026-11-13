import type { DatasourceSelector } from '@perses-dev/spec';

import type { ResourceName } from '../model/resources';

/** Fields shared by the variable and the state query: which objects to read. */
export interface ResourceSelection {
  datasource?: DatasourceSelector;
  resource: ResourceName;
  /** `group/version/resource` when `resource` is `custom`. */
  customResource?: string;
  /** A namespace, `$variable`, or a comma-separated list; empty means all namespaces. */
  namespace?: string;
  labelSelector?: string;
  fieldSelector?: string;
}
