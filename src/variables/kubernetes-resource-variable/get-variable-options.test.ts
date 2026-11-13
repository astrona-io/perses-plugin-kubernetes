import type { DatasourceStore, VariableStateMap } from '@perses-dev/plugin-system';

import { fakeApi, pod, vars } from '../../test/fakes';
import { getVariableOptions, objectsToOptions } from './get-variable-options';
import type { KubernetesResourceVariableSpec } from './kubernetes-resource-variable-types';

const ctx = (store: DatasourceStore, variables: VariableStateMap = {}): Parameters<typeof getVariableOptions>[1] =>
  ({
    datasourceStore: store,
    variables,
    timeRange: { start: new Date(0), end: new Date(1) },
  }) as unknown as Parameters<typeof getVariableOptions>[1];

describe('objectsToOptions', () => {
  it('is empty for no objects', () => {
    expect(objectsToOptions([], { resource: 'pods' })).toEqual([]);
  });

  it('uses the name by default, dedupes and sorts', () => {
    const objs = [pod('b', 'web-2'), pod('a', 'web-1'), pod('c', 'web-1')];
    expect(objectsToOptions(objs, { resource: 'pods' })).toEqual([
      { value: 'web-1', label: 'web-1' },
      { value: 'web-2', label: 'web-2' },
    ]);
  });

  it('reads valueField and labelField, and filters with a regex', () => {
    const objs = [
      pod('shop', 'web-1', { labels: { app: 'web' } }),
      pod('shop', 'db-0', { labels: { app: 'db' } }),
      pod('shop', 'cache-0', {}),
    ];
    const spec: KubernetesResourceVariableSpec = {
      resource: 'pods',
      valueField: ".metadata.labels['app']",
      labelField: '.metadata.name',
      filter: '^w',
    };
    expect(objectsToOptions(objs, spec)).toEqual([{ value: 'web', label: 'web-1' }]);
  });

  it('gives one option per value of a multi-value path', () => {
    const obj = {
      metadata: { name: 'x' },
      spec: { containers: [{ image: 'b:1' }, { image: 'a:1' }] },
    };
    expect(
      objectsToOptions([obj], {
        resource: 'pods',
        valueField: '.spec.containers[*].image',
      }),
    ).toEqual([
      { value: 'a:1', label: 'a:1' },
      { value: 'b:1', label: 'b:1' },
    ]);
  });

  it('handles a large list', () => {
    const objs = Array.from({ length: 10_000 }, (_, i) => pod('ns', `pod-${String(i).padStart(5, '0')}`));
    const options = objectsToOptions(objs, { resource: 'pods' });
    expect(options).toHaveLength(10_000);
    expect(options[0]?.value).toBe('pod-00000');
    expect(options.at(-1)?.value).toBe('pod-09999');
  });

  it('rejects an invalid filter', () => {
    expect(() => objectsToOptions([pod('a', 'b')], { resource: 'pods', filter: '(' })).toThrow();
  });
});

describe('getVariableOptions', () => {
  it('lists namespaces cluster-wide', async () => {
    const { store, requests } = fakeApi({
      '/api/v1/namespaces': [{ metadata: { name: 'shop' } }],
    });
    const result = await getVariableOptions({ resource: 'namespaces' }, ctx(store));
    expect(result.data).toEqual([{ value: 'shop', label: 'shop' }]);
    expect(requests[0]?.url.pathname).toBe('/proxy/globaldatasources/kubernetes/api/v1/namespaces');
  });

  it('fans out over a multi-value namespace variable and passes selectors', async () => {
    const { store, requests } = fakeApi({
      '/apis/apps/v1/namespaces/a/deployments': [{ metadata: { name: 'web', namespace: 'a' } }],
      '/apis/apps/v1/namespaces/b/deployments': [{ metadata: { name: 'api', namespace: 'b' } }],
    });
    const result = await getVariableOptions(
      {
        resource: 'deployments',
        namespace: '$namespace',
        labelSelector: 'tier=$tier',
      },
      ctx(store, vars({ namespace: ['a', 'b'], tier: 'front' })),
    );
    expect(result.data.map((o) => o.value)).toEqual(['api', 'web']);
    expect(requests).toHaveLength(2);
    expect(requests.every((r) => r.url.searchParams.get('labelSelector') === 'tier=front')).toBe(true);
  });

  it('lists across the cluster when the namespace variable is All', async () => {
    const { store, requests } = fakeApi({ '/api/v1/pods': [pod('a', 'x')] });
    await getVariableOptions({ resource: 'pods', namespace: '$namespace' }, ctx(store, vars({ namespace: '$__all' })));
    expect(requests[0]?.url.pathname).toBe('/proxy/globaldatasources/kubernetes/api/v1/pods');
  });

  it('refuses a namespace value that would change the path', async () => {
    const { store, requests } = fakeApi({});
    await expect(
      getVariableOptions({ resource: 'pods', namespace: '$namespace' }, ctx(store, vars({ namespace: '../secrets' }))),
    ).rejects.toThrow('invalid namespace');
    expect(requests).toHaveLength(0);
  });

  it('refuses secrets as a custom resource', async () => {
    const { store } = fakeApi({});
    await expect(getVariableOptions({ resource: 'custom', customResource: 'v1/secrets' }, ctx(store))).rejects.toThrow(
      'not readable',
    );
  });

  it('surfaces API errors', async () => {
    const { store } = fakeApi({});
    await expect(getVariableOptions({ resource: 'nodes' }, ctx(store))).rejects.toThrow('not found');
  });
});

describe('getVariableOptions chaining', () => {
  it('resolves variables in the filter', async () => {
    const { store } = fakeApi({
      '/api/v1/namespaces/shop/pods': [
        pod('shop', 'web-5d9f-abcde'),
        pod('shop', 'api-7c4b-fghij'),
        pod('shop', 'webhook-0'),
      ],
    });
    const result = await getVariableOptions(
      { resource: 'pods', namespace: '$namespace', filter: '^$deployment-[a-z0-9]+-[a-z0-9]+$' },
      ctx(store, vars({ namespace: 'shop', deployment: ['web', 'api'] })),
    );
    expect(result.data.map((o) => o.value)).toEqual(['api-7c4b-fghij', 'web-5d9f-abcde']);
  });
});
