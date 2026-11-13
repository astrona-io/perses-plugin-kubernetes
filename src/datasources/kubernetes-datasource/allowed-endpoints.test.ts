import schemaExample from '../../../schemas/datasources/kubernetes-datasource/kubernetes-datasource.json' with { type: 'json' };
import { listPath, parseCustomResource, resolveResource, BUILTIN_RESOURCES, EVENTS } from '../../model/resources';
import { allowListProblems, customResourceEndpoint, DEFAULT_ALLOWED_ENDPOINTS, isAllowed } from './allowed-endpoints';

// Paths the proxy must never forward, whatever the plugin asks for.
const DENIED_PATHS = [
  '/api/v1/secrets',
  '/api/v1/namespaces/shop/secrets',
  '/api/v1/namespaces/shop/secrets/db',
  '/api/v1/namespaces/shop/pods/web-1',
  '/api/v1/namespaces/shop/pods/web-1/exec',
  '/api/v1/namespaces/shop/pods/web-1/attach',
  '/api/v1/namespaces/shop/pods/web-1/log',
  '/api/v1/namespaces/shop/pods/web-1/portforward',
  '/api/v1/namespaces/shop/pods/web-1/proxy',
  '/api/v1/namespaces/shop/services/web:80/proxy/',
  '/api/v1/nodes/node-1/proxy/metrics',
  '/api/v1/namespaces/shop',
  '/api/v1/namespaces/shop/configmaps',
  '/api/v1/namespaces/shop/serviceaccounts/default/token',
  '/api/v1/watch/pods',
  '/api/v1/watch/namespaces/shop/pods',
  '/apis/apps/v1/namespaces/shop/deployments/web/scale',
  '/apis/apps/v1/namespaces/shop/deployments/web',
  '/apis/rbac.authorization.k8s.io/v1/clusterroles',
  '/apis/authentication.k8s.io/v1/tokenreviews',
  '/api/v1/namespaces/../secrets',
  '/api/v1/namespaces/a/b/pods',
  '/api/v1/namespaces/UPPER/pods',
  '/x/api/v1/pods',
  '/api/v1/pods/',
  '/api/v1/podsx',
  '/version',
  '/',
];

describe('default allow-list', () => {
  it('is the one in the schema example', () => {
    expect(schemaExample.spec.proxy.spec.allowedEndpoints).toEqual(DEFAULT_ALLOWED_ENDPOINTS);
  });

  it('has no problems', () => {
    expect(allowListProblems(DEFAULT_ALLOWED_ENDPOINTS)).toEqual([]);
  });

  it('allows every list path the plugin builds, across the cluster and in a namespace', () => {
    for (const r of BUILTIN_RESOURCES) {
      const ref = resolveResource(r);
      expect(isAllowed(DEFAULT_ALLOWED_ENDPOINTS, 'GET', listPath(ref))).toBe(true);
      expect(isAllowed(DEFAULT_ALLOWED_ENDPOINTS, 'GET', listPath(ref, 'shop-1'))).toBe(true);
    }
    expect(isAllowed(DEFAULT_ALLOWED_ENDPOINTS, 'GET', listPath(EVENTS, 'shop'))).toBe(true);
  });

  it('refuses every other method', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'get']) {
      expect(isAllowed(DEFAULT_ALLOWED_ENDPOINTS, method, '/api/v1/pods')).toBe(false);
    }
  });

  it.each(DENIED_PATHS)('refuses GET %s', (path) => {
    expect(isAllowed(DEFAULT_ALLOWED_ENDPOINTS, 'GET', path)).toBe(false);
  });

  it('builds an anchored entry for a custom resource', () => {
    const e = customResourceEndpoint('example.com', 'v1', 'widgets');
    expect(allowListProblems([e])).toEqual([]);
    const ref = parseCustomResource('example.com/v1/widgets');
    expect(isAllowed([e], 'GET', listPath(ref))).toBe(true);
    expect(isAllowed([e], 'GET', listPath(ref, 'shop'))).toBe(true);
    expect(isAllowed([e], 'GET', '/apis/exampleXcom/v1/widgets')).toBe(false);
    expect(isAllowed([e], 'GET', '/apis/example.com/v1/namespaces/shop/widgets/one')).toBe(false);
  });
});

describe('allowListProblems', () => {
  it('flags an empty list, other methods, unanchored and dangerous patterns', () => {
    expect(allowListProblems(undefined)).toHaveLength(1);
    expect(allowListProblems([])).toHaveLength(1);
    expect(allowListProblems([{ endpointPattern: '^/api/v1/pods$', method: 'POST' }])[0]).toContain('only GET');
    expect(allowListProblems([{ endpointPattern: '/api/v1/pods', method: 'GET' }])[0]).toContain('anchored');
    expect(allowListProblems([{ endpointPattern: '^/api/v1/secrets$', method: 'GET' }])[0]).toContain('never allowed');
  });

  it('treats an empty list as allowing everything, like Perses does', () => {
    expect(isAllowed([], 'DELETE', '/api/v1/namespaces/shop')).toBe(true);
  });
});
