// Kubernetes resources this plugin can list, and how their API paths are built.
//
// Every path built here is a *list* path (`.../<resource>`), never a single object, a subresource
// (`/exec`, `/log`, `/attach`, `/proxy`, `/status`, ...) or a watch. The Perses proxy enforces the same
// shape with the datasource allow-list (see allowed-endpoints.ts); this file is the client-side half
// of that defence, so a variable value can never be turned into another path.

export const BUILTIN_RESOURCES = [
  'namespaces',
  'nodes',
  'pods',
  'deployments',
  'statefulsets',
  'daemonsets',
  'replicasets',
] as const;

export type BuiltinResource = (typeof BUILTIN_RESOURCES)[number];
export type ResourceName = BuiltinResource | 'custom';

export interface ResourceRef {
  /** API group, empty for the core group. */
  group: string;
  version: string;
  /** Plural, lower-case resource name, as in the API path. */
  resource: string;
  /** False for cluster-scoped resources: a namespace is then ignored. */
  namespaced: boolean;
}

const BUILTINS: Record<BuiltinResource, ResourceRef> = {
  namespaces: { group: '', version: 'v1', resource: 'namespaces', namespaced: false },
  nodes: { group: '', version: 'v1', resource: 'nodes', namespaced: false },
  pods: { group: '', version: 'v1', resource: 'pods', namespaced: true },
  deployments: { group: 'apps', version: 'v1', resource: 'deployments', namespaced: true },
  statefulsets: { group: 'apps', version: 'v1', resource: 'statefulsets', namespaced: true },
  daemonsets: { group: 'apps', version: 'v1', resource: 'daemonsets', namespaced: true },
  replicasets: { group: 'apps', version: 'v1', resource: 'replicasets', namespaced: true },
};

export const EVENTS: ResourceRef = { group: '', version: 'v1', resource: 'events', namespaced: true };

/** RFC 1123 label: what a namespace name must look like. */
export const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
/** RFC 1123 subdomain: what an API group must look like. */
const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const VERSION = /^v[0-9]+((alpha|beta)[0-9]+)?$/;
const PLURAL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/** Resources that must never be reachable, even as a custom resource. */
const FORBIDDEN_RESOURCES = new Set(['secrets', 'serviceaccounts', 'tokenreviews', 'subjectaccessreviews']);

/**
 * Parses a custom resource written as `group/version/resource` (or `version/resource` for the core group),
 * e.g. `kustomize.toolkit.fluxcd.io/v1/kustomizations` or `v1/services`.
 * Custom resources are listed across all namespaces when no namespace is set, and in one namespace otherwise
 * (a cluster-scoped custom resource must be used without a namespace).
 */
export function parseCustomResource(value: string): ResourceRef {
  const parts = value.trim().split('/');
  let group = '';
  let version: string | undefined;
  let resource: string | undefined;
  if (parts.length === 3) {
    [group, version, resource] = parts as [string, string, string];
  } else if (parts.length === 2) {
    [version, resource] = parts as [string, string];
  } else {
    throw new Error(`custom resource "${value}" must be written as group/version/resource`);
  }
  if (group !== '' && !DNS_SUBDOMAIN.test(group)) {
    throw new Error(`custom resource "${value}": invalid API group "${group}"`);
  }
  if (!VERSION.test(version)) {
    throw new Error(`custom resource "${value}": invalid API version "${version}"`);
  }
  if (!PLURAL.test(resource)) {
    throw new Error(`custom resource "${value}": invalid resource "${resource}"`);
  }
  if (FORBIDDEN_RESOURCES.has(resource)) {
    throw new Error(`the resource "${resource}" is not readable through this plugin`);
  }
  return { group, version, resource, namespaced: true };
}

export function resolveResource(resource: ResourceName, customResource?: string): ResourceRef {
  if (resource === 'custom') {
    if (customResource === undefined || customResource.trim() === '') {
      throw new Error('a custom resource needs customResource (group/version/resource)');
    }
    return parseCustomResource(customResource);
  }
  const ref = BUILTINS[resource];
  if (ref === undefined) {
    throw new Error(`unknown resource "${String(resource)}"`);
  }
  return ref;
}

/**
 * Builds the list path of a resource, e.g. `/apis/apps/v1/namespaces/shop/deployments`.
 * The namespace is validated as a DNS label so a variable value can't add path segments.
 */
export function listPath(ref: ResourceRef, namespace?: string): string {
  const prefix = ref.group === '' ? `/api/${ref.version}` : `/apis/${ref.group}/${ref.version}`;
  if (namespace !== undefined && namespace !== '' && ref.namespaced) {
    if (!DNS_LABEL.test(namespace)) {
      throw new Error(`invalid namespace "${namespace}"`);
    }
    return `${prefix}/namespaces/${namespace}/${ref.resource}`;
  }
  return `${prefix}/${ref.resource}`;
}

/** The Kubernetes kind for a builtin resource, used to label series and log lines. */
export function kindOf(ref: ResourceRef): string {
  const known: Record<string, string> = {
    namespaces: 'Namespace',
    nodes: 'Node',
    pods: 'Pod',
    deployments: 'Deployment',
    statefulsets: 'StatefulSet',
    daemonsets: 'DaemonSet',
    replicasets: 'ReplicaSet',
    events: 'Event',
  };
  return known[ref.resource] ?? ref.resource;
}
