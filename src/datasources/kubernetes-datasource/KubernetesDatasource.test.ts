import { fakeApi } from '../../test/fakes';
import { DEFAULT_ALLOWED_ENDPOINTS } from './allowed-endpoints';
import { createKubernetesClient, KubernetesDatasource } from './KubernetesDatasource';

const items = (n: number): Array<{ metadata: { name: string } }> =>
  Array.from({ length: n }, (_, i) => ({ metadata: { name: `ns-${i}` } }));

describe('KubernetesDatasource client', () => {
  it('needs the Perses proxy', () => {
    expect(() => createKubernetesClient({ proxy: { kind: 'HTTPProxy', spec: { url: 'x' } } }, {})).toThrow(
      'through the Perses proxy only',
    );
  });

  it('starts with the default allow-list', () => {
    expect(KubernetesDatasource.createInitialOptions?.()).toMatchObject({
      proxy: { spec: { allowedEndpoints: DEFAULT_ALLOWED_ENDPOINTS } },
    });
  });

  it('returns an empty list', async () => {
    const { client, requests } = fakeApi({ '/api/v1/namespaces': [] });
    await expect(client.list('/api/v1/namespaces')).resolves.toEqual({
      items: [],
      truncated: false,
      pages: 1,
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
  });

  it('follows continue tokens and sends selectors to the API server', async () => {
    const { client, requests } = fakeApi({ '/api/v1/pods': items(1200) });
    const result = await client.list('/api/v1/pods', {
      labelSelector: 'app=web',
      fieldSelector: 'status.phase=Running',
    });
    expect(result.items).toHaveLength(1200);
    expect(result.truncated).toBe(false);
    expect(result.pages).toBe(3);
    expect(requests.map((r) => r.url.searchParams.get('continue'))).toEqual([null, '500', '1000']);
    for (const r of requests) {
      expect(r.url.searchParams.get('labelSelector')).toBe('app=web');
      expect(r.url.searchParams.get('fieldSelector')).toBe('status.phase=Running');
      expect(r.url.searchParams.get('watch')).toBeNull();
      expect(r.method).toBe('GET');
    }
  });

  it('stops at maxItems and says the result is truncated', async () => {
    const { client, requests } = fakeApi({ '/api/v1/pods': items(20_000) });
    const result = await client.list('/api/v1/pods');
    expect(result.items).toHaveLength(5000);
    expect(result.truncated).toBe(true);
    expect(requests).toHaveLength(10);
  });

  it('is not truncated when the last page ends exactly at maxItems', async () => {
    const { client } = fakeApi({ '/api/v1/pods': items(10) });
    await expect(client.list('/api/v1/pods', { maxItems: 10, pageSize: 5 })).resolves.toMatchObject({
      truncated: false,
    });
  });

  it('surfaces API errors', async () => {
    const { client } = fakeApi({});
    await expect(client.list('/api/v1/pods')).rejects.toThrow('not found: /api/v1/pods');
  });

  it('refuses paths that are not list paths', async () => {
    const { client, requests } = fakeApi({});
    for (const bad of ['/api/v1/pods?watch=true', '/api/v1/../v1/secrets', 'http://evil/api', '/version', '']) {
      await expect(client.list(bad)).rejects.toThrow('not a Kubernetes list path');
    }
    expect(requests).toHaveLength(0);
  });

  it('reports health', async () => {
    await expect(fakeApi({ '/api/v1/namespaces': [] }).client.healthCheck?.()).resolves.toBe(true);
    await expect(fakeApi({}).client.healthCheck?.()).resolves.toBe(false);
  });
});
