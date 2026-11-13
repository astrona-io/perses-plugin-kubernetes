import type { DatasourceStore, VariableStateMap } from '@perses-dev/plugin-system';

import type { KubernetesDatasourceClient } from '../datasources/kubernetes-datasource/kubernetes-datasource-types';
import { createKubernetesClient } from '../datasources/kubernetes-datasource/KubernetesDatasource';

export interface Recorded {
  url: URL;
  method: string;
}

/**
 * A fake API server behind the proxy: `routes` maps a path to the full list of items, which it pages with
 * `limit` and `continue` like the real one. Every request is recorded.
 */
export function fakeApi(routes: Record<string, unknown[]>): {
  client: KubernetesDatasourceClient;
  requests: Recorded[];
  store: DatasourceStore;
} {
  const requests: Recorded[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://perses.test');
    requests.push({ url, method: init?.method ?? 'GET' });
    const path = url.pathname.replace('/proxy/globaldatasources/kubernetes', '');
    const items = routes[path];
    if (items === undefined) {
      return new Response(JSON.stringify({ kind: 'Status', message: `not found: ${path}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    const limit = Number(url.searchParams.get('limit') ?? items.length);
    const offset = Number(url.searchParams.get('continue') ?? 0);
    const page = items.slice(offset, offset + limit);
    const next = offset + limit < items.length ? String(offset + limit) : undefined;
    return new Response(JSON.stringify({ kind: 'List', metadata: next ? { continue: next } : {}, items: page }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createKubernetesClient(
    { proxy: { kind: 'HTTPProxy', spec: { url: 'https://kubernetes.default.svc' } } },
    { proxyUrl: '/proxy/globaldatasources/kubernetes', fetch: fetch as typeof globalThis.fetch },
  );
  const store = { getDatasourceClient: async () => client } as unknown as DatasourceStore;
  return { client, requests, store };
}

export function vars(values: Record<string, string | string[]>): VariableStateMap {
  return Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value, loading: false }]));
}

export function pod(
  namespace: string,
  name: string,
  extra: { phase?: string; waiting?: string; labels?: Record<string, string>; node?: string } = {},
): Record<string, unknown> {
  return {
    metadata: { name, namespace, labels: extra.labels ?? {} },
    spec: { nodeName: extra.node ?? 'node-1' },
    status: {
      phase: extra.phase ?? 'Running',
      containerStatuses: extra.waiting ? [{ name: 'app', state: { waiting: { reason: extra.waiting } } }] : [],
    },
  };
}
