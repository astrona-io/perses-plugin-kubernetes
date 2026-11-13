import type { DatasourceStore } from '@perses-dev/plugin-system';
import type { DatasourceSelector } from '@perses-dev/spec';

import type {
  KubernetesDatasourceClient,
  KubernetesObject,
} from '../datasources/kubernetes-datasource/kubernetes-datasource-types';
import { DEFAULT_DATASOURCE } from './constants';
import type { ResourceRef } from './resources';
import { listPath } from './resources';

export interface ListRequest {
  ref: ResourceRef;
  /** undefined: all namespaces (or a cluster-scoped resource). */
  namespaces?: string[];
  labelSelector?: string;
  fieldSelector?: string;
  maxItems?: number;
  signal?: AbortSignal;
}

export interface ListResponse<T = KubernetesObject> {
  items: T[];
  truncated: boolean;
  /** The API paths that were requested, for the query inspector. */
  paths: string[];
}

export async function getClient(
  store: DatasourceStore,
  selector: DatasourceSelector | undefined,
): Promise<KubernetesDatasourceClient> {
  return store.getDatasourceClient<KubernetesDatasourceClient>(selector ?? DEFAULT_DATASOURCE);
}

/**
 * Lists a resource across the cluster, or in each of the given namespaces (requests run in parallel),
 * with label and field selectors applied by the API server.
 */
export async function listObjects<T = KubernetesObject>(
  client: KubernetesDatasourceClient,
  req: ListRequest,
): Promise<ListResponse<T>> {
  const paths =
    req.namespaces === undefined || !req.ref.namespaced
      ? [listPath(req.ref)]
      : req.namespaces.map((ns) => listPath(req.ref, ns));
  const results = await Promise.all(
    paths.map((path) =>
      client.list<T>(path, {
        labelSelector: req.labelSelector,
        fieldSelector: req.fieldSelector,
        maxItems: req.maxItems,
        signal: req.signal,
      }),
    ),
  );
  return {
    items: results.flatMap((r) => r.items),
    truncated: results.some((r) => r.truncated),
    paths,
  };
}
