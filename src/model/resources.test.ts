import { kindOf, listPath, parseCustomResource, resolveResource } from './resources';

describe('resources', () => {
  it('builds list paths for builtin resources', () => {
    expect(listPath(resolveResource('pods'))).toBe('/api/v1/pods');
    expect(listPath(resolveResource('pods'), 'shop')).toBe('/api/v1/namespaces/shop/pods');
    expect(listPath(resolveResource('deployments'), 'shop')).toBe('/apis/apps/v1/namespaces/shop/deployments');
    // Cluster-scoped resources ignore the namespace.
    expect(listPath(resolveResource('nodes'), 'shop')).toBe('/api/v1/nodes');
    expect(listPath(resolveResource('namespaces'))).toBe('/api/v1/namespaces');
  });

  it('refuses a namespace that would change the path', () => {
    const pods = resolveResource('pods');
    for (const bad of ['../secrets', 'a/b', 'UPPER', 'x?watch=true', '-lead', 'a b']) {
      expect(() => listPath(pods, bad)).toThrow('invalid namespace');
    }
  });

  it('parses custom resources', () => {
    expect(parseCustomResource('example.com/v1/widgets')).toEqual({
      group: 'example.com',
      version: 'v1',
      resource: 'widgets',
      namespaced: true,
    });
    expect(listPath(parseCustomResource('v1/services'), 'shop')).toBe('/api/v1/namespaces/shop/services');
    expect(listPath(parseCustomResource('example.com/v1beta2/widgets'))).toBe('/apis/example.com/v1beta2/widgets');
  });

  it('rejects malformed and forbidden custom resources', () => {
    expect(() => parseCustomResource('widgets')).toThrow('group/version/resource');
    expect(() => parseCustomResource('a/b/c/d')).toThrow('group/version/resource');
    expect(() => parseCustomResource('Example.com/v1/widgets')).toThrow('invalid API group');
    expect(() => parseCustomResource('example.com/one/widgets')).toThrow('invalid API version');
    expect(() => parseCustomResource('example.com/v1/Widgets')).toThrow('invalid resource');
    expect(() => parseCustomResource('v1/secrets')).toThrow('not readable');
    expect(() => parseCustomResource('v1/serviceaccounts')).toThrow('not readable');
    expect(() => resolveResource('custom')).toThrow('needs customResource');
    expect(() => resolveResource('secrets' as 'pods')).toThrow('unknown resource');
  });

  it('names kinds', () => {
    expect(kindOf(resolveResource('statefulsets'))).toBe('StatefulSet');
    expect(kindOf(parseCustomResource('example.com/v1/widgets'))).toBe('widgets');
  });
});
