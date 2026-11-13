import { fetch as persesFetch } from '@perses-dev/client';
import type { DatasourceClientOptions, DatasourcePlugin } from '@perses-dev/plugin-system';

import { DEFAULT_ALLOWED_ENDPOINTS } from './allowed-endpoints';
import type {
  KubernetesDatasourceClient,
  KubernetesDatasourceSpec,
  KubernetesList,
  KubernetesObject,
  ListOptions,
  ListResult,
} from './kubernetes-datasource-types';
import { KubernetesDatasourceEditor } from './KubernetesDatasourceEditor';

export const DEFAULT_PAGE_SIZE = 500;
export const DEFAULT_MAX_ITEMS = 5000;
/** The request the editor's "Test connection" button and the health check make. */
export const HEALTH_CHECK_PATH = '/api/v1/namespaces?limit=1';

/** A list path: `/api/v1/...` or `/apis/<group>/<version>/...`, no query string, no `..`. */
const LIST_PATH = /^\/apis?\/[a-z0-9.-]+(\/[a-z0-9.-]+)*$/;

export function createKubernetesClient(
  spec: KubernetesDatasourceSpec,
  options: DatasourceClientOptions,
): KubernetesDatasourceClient {
  const { proxyUrl } = options;
  if (proxyUrl === undefined || proxyUrl === '') {
    throw new Error('KubernetesDatasource works through the Perses proxy only: save the datasource in Perses first');
  }
  if (spec.proxy === undefined) {
    throw new Error('KubernetesDatasource needs a proxy spec (the API server URL and a secret)');
  }
  const doFetch = options.fetch ?? persesFetch;
  const datasourceUrl = proxyUrl.replace(/\/$/, '');

  async function getPage<T>(path: string, params: URLSearchParams, signal?: AbortSignal): Promise<KubernetesList<T>> {
    const response = await doFetch(`${datasourceUrl}${path}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch (e) {
      throw new Error(`the API server returned a response that is not JSON for ${path} (HTTP ${response.status})`, {
        cause: e,
      });
    }
    if (!response.ok) {
      // A Kubernetes Status object carries a readable message (e.g. `pods is forbidden: ...`).
      const message = (body as { message?: unknown } | null)?.message;
      throw new Error(typeof message === 'string' && message !== '' ? message : `HTTP ${response.status} for ${path}`);
    }
    if (typeof body !== 'object' || body === null || !Array.isArray((body as KubernetesList<T>).items)) {
      throw new Error(`the API server returned a response that is not a list for ${path}`);
    }
    return body as KubernetesList<T>;
  }

  async function list<T = KubernetesObject>(path: string, opts: ListOptions = {}): Promise<ListResult<T>> {
    if (!LIST_PATH.test(path) || path.includes('..')) {
      throw new Error(`refusing to request "${path}": not a Kubernetes list path`);
    }
    const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS;
    const items: T[] = [];
    let cont: string | undefined;
    let pages = 0;
    do {
      const params = new URLSearchParams();
      params.set('limit', String(Math.min(pageSize, maxItems - items.length)));
      if (opts.labelSelector) params.set('labelSelector', opts.labelSelector);
      if (opts.fieldSelector) params.set('fieldSelector', opts.fieldSelector);
      if (cont) params.set('continue', cont);
      // Pages are sequential by nature: each request needs the previous page's continue token.
      // oxlint-disable-next-line no-await-in-loop
      const page = await getPage<T>(path, params, opts.signal);
      pages++;
      items.push(...page.items);
      cont = page.metadata?.continue || undefined;
      if (items.length >= maxItems) {
        return { items: items.slice(0, maxItems), truncated: cont !== undefined || items.length > maxItems, pages };
      }
    } while (cont !== undefined);
    return { items, truncated: false, pages };
  }

  return {
    kind: 'KubernetesDatasource',
    options: { datasourceUrl },
    list,
    healthCheck: async () => {
      try {
        const response = await doFetch(`${datasourceUrl}${HEALTH_CHECK_PATH}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

export const KubernetesDatasource: DatasourcePlugin<KubernetesDatasourceSpec, KubernetesDatasourceClient> = {
  createClient: createKubernetesClient,
  OptionsEditorComponent: KubernetesDatasourceEditor,
  createInitialOptions: () => ({
    proxy: {
      kind: 'HTTPProxy',
      spec: {
        url: 'https://kubernetes.default.svc',
        allowedEndpoints: DEFAULT_ALLOWED_ENDPOINTS.map((e) => Object.assign({}, e)),
      },
    },
  }),
};
