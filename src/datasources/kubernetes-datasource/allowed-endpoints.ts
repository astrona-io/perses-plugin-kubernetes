// The default allow-list of the Perses proxy for a KubernetesDatasource.
//
// The Perses proxy forwards a request only when its method equals `method` and `endpointPattern` (a Go regular
// expression) matches somewhere in the path. Patterns are therefore anchored (^...$): an unanchored pattern such as
// "/api/v1/pods" would also match "/api/v1/namespaces/x/pods/y/exec".
//
// What this list allows: GET on the *list* endpoints of the builtin resources this plugin reads, across the
// cluster or in one namespace. What it never allows: any other method, single objects, subresources
// (exec, attach, log, portforward, proxy, status, ...), secrets, or any other resource.
//
// What it can't do: the proxy matches the path only, not the query string, so `?watch=true` is blocked by RBAC
// instead (deploy/rbac.yaml grants get and list, never watch). The CUE schema rejects a datasource whose
// allow-list has a non-GET method or an unanchored pattern.
//
// The same list is in schemas/datasources/kubernetes-datasource/kubernetes-datasource.json; a test keeps them equal,
// and the Go test in test/allowlist/allowlist_test.go checks it with Go's regexp engine, the one the proxy uses.

export interface AllowedEndpoint {
  endpointPattern: string;
  method: 'GET';
}

/** A namespace name (RFC 1123 label), as a regular expression fragment. */
export const NAMESPACE_PATTERN = '[a-z0-9]([-a-z0-9]*[a-z0-9])?';

export const DEFAULT_ALLOWED_ENDPOINTS: AllowedEndpoint[] = [
  { endpointPattern: '^/api/v1/(namespaces|nodes)$', method: 'GET' },
  { endpointPattern: `^/api/v1/(namespaces/${NAMESPACE_PATTERN}/)?(pods|events)$`, method: 'GET' },
  {
    endpointPattern: `^/apis/apps/v1/(namespaces/${NAMESPACE_PATTERN}/)?(deployments|statefulsets|daemonsets|replicasets)$`,
    method: 'GET',
  },
];

/** Escapes an API group for a regular expression (dots are literal). */
function escapeGroup(group: string): string {
  return group.replace(/[.\\^$*+?()[\]{}|-]/g, '\\$&');
}

/**
 * The allow-list entry for one custom resource, e.g.
 * customResourceEndpoint('kustomize.toolkit.fluxcd.io', 'v1', 'kustomizations').
 */
export function customResourceEndpoint(group: string, version: string, resource: string): AllowedEndpoint {
  return {
    endpointPattern: `^/apis/${escapeGroup(group)}/${version}/(namespaces/${NAMESPACE_PATTERN}/)?${resource}$`,
    method: 'GET',
  };
}

/**
 * True when the proxy would forward `method path` with this allow-list, using the same rule as Perses
 * (method equality and a regex match anywhere in the path). Only used by tests and the editor's warnings.
 */
export function isAllowed(endpoints: AllowedEndpoint[] | undefined, method: string, path: string): boolean {
  if (endpoints === undefined || endpoints.length === 0) {
    // Perses forwards everything when the list is empty: never treat that as safe.
    return true;
  }
  return endpoints.some((e) => e.method === method && new RegExp(e.endpointPattern).test(path));
}

/** Returns the reasons an allow-list is unsafe, empty when it is fine. */
export function allowListProblems(endpoints: Array<{ endpointPattern: string; method: string }> | undefined): string[] {
  if (endpoints === undefined || endpoints.length === 0) {
    return ['the allow-list is empty: the proxy would forward any request to the API server'];
  }
  const problems: string[] = [];
  for (const e of endpoints) {
    if (e.method !== 'GET') {
      problems.push(`${e.method} ${e.endpointPattern}: only GET is allowed`);
    }
    if (!e.endpointPattern.startsWith('^') || !e.endpointPattern.endsWith('$')) {
      problems.push(`${e.endpointPattern}: patterns must be anchored with ^ and $`);
    }
    if (/secrets|exec|attach|portforward|proxy|\/log|watch/.test(e.endpointPattern)) {
      problems.push(`${e.endpointPattern}: secrets, exec, attach, portforward, proxy, log and watch are never allowed`);
    }
  }
  return problems;
}
