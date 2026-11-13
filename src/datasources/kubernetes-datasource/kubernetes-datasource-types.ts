import type { DatasourceClient } from '@perses-dev/plugin-system';
import type { HTTPProxy } from '@perses-dev/spec';

/**
 * A KubernetesDatasource talks to the Kubernetes API server through the Perses backend proxy only.
 * There is no `directUrl`: the browser must never hold a cluster token. The proxy adds the token (and CA)
 * from a Perses secret and forwards GET requests on the allow-list only.
 */
export interface KubernetesDatasourceSpec {
  proxy: HTTPProxy;
}

/** The shape every Kubernetes list response shares. */
export interface KubernetesList<T = KubernetesObject> {
  kind?: string;
  apiVersion?: string;
  metadata?: { continue?: string; resourceVersion?: string; remainingItemCount?: number };
  items: T[];
}

export interface KubernetesObject {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    uid?: string;
    labels?: Record<string, string>;
    creationTimestamp?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ListOptions {
  labelSelector?: string;
  fieldSelector?: string;
  /** Page size sent as `limit`; the client follows `continue` until done or `maxItems`. */
  pageSize?: number;
  /** Stop after this many items and flag the result as truncated. */
  maxItems?: number;
  signal?: AbortSignal;
}

export interface ListResult<T = KubernetesObject> {
  items: T[];
  /** True when `maxItems` was reached before the API server ran out of pages. */
  truncated: boolean;
  /** Number of requests made (one per page). */
  pages: number;
}

export interface KubernetesDatasourceClient extends DatasourceClient {
  options: { datasourceUrl: string };
  /** Lists a resource at an API path built by `listPath` (a list path, never a single object). */
  list<T = KubernetesObject>(path: string, options?: ListOptions): Promise<ListResult<T>>;
}
