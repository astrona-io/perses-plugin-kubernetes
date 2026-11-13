import { Alert, Box, Stack, Typography } from '@mui/material';
import type { DatasourceEditorProps } from '@perses-dev/plugin-system';
import { DatasourceTestConnectionButton } from '@perses-dev/plugin-system';
import type { HTTPAllowedEndpoint, HTTPProxySpec } from '@perses-dev/spec';
import type { ReactElement } from 'react';
import { useCallback, useMemo } from 'react';

import { OptionalTextField } from '../../components/fields';
import { allowListProblems, DEFAULT_ALLOWED_ENDPOINTS } from './allowed-endpoints';
import { AllowedEndpointsEditor } from './AllowedEndpointsEditor';
import type { KubernetesDatasourceSpec } from './kubernetes-datasource-types';

export type KubernetesDatasourceEditorProps = DatasourceEditorProps<KubernetesDatasourceSpec>;

const EMPTY_PROXY_SPEC: HTTPProxySpec = { url: '', allowedEndpoints: DEFAULT_ALLOWED_ENDPOINTS };

/**
 * Edits the API server URL, the Perses secret that holds the token and CA, the timeout and the allow-list.
 * There is deliberately no "direct access" mode: the browser must never call the API server itself.
 */
export function KubernetesDatasourceEditor(props: KubernetesDatasourceEditorProps): ReactElement {
  const { value, onChange, isReadonly, testConnection } = props;
  const proxySpec = value.proxy?.spec ?? EMPTY_PROXY_SPEC;
  const endpoints = useMemo(() => proxySpec.allowedEndpoints ?? [], [proxySpec.allowedEndpoints]);
  const problems = useMemo(() => allowListProblems(endpoints), [endpoints]);

  const update = useCallback(
    (patch: Partial<HTTPProxySpec>) => {
      onChange({ ...value, proxy: { kind: 'HTTPProxy', spec: { ...proxySpec, ...patch } } });
    },
    [onChange, value, proxySpec],
  );

  const setEndpoints = useCallback((allowedEndpoints: HTTPAllowedEndpoint[]) => update({ allowedEndpoints }), [update]);
  const setUrl = useCallback((url: string | undefined) => update({ url: url ?? '' }), [update]);
  const setSecret = useCallback((secret: string | undefined) => update({ secret }), [update]);
  const setTimeout = useCallback(
    (timeout: string | undefined) => update({ timeout: timeout as HTTPProxySpec['timeout'] }),
    [update],
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Perses calls the Kubernetes API server for you, through its proxy. The browser never sees the token: it comes
        from the Perses secret named below. Only GET requests on the allow-list are forwarded.
      </Typography>
      <OptionalTextField
        label="API server URL"
        placeholder="https://kubernetes.default.svc"
        value={proxySpec.url}
        onChange={setUrl}
        readOnly={isReadonly}
      />
      <OptionalTextField
        label="Secret"
        helperText="Name of the Perses secret with the bearer token (or token file) and the CA certificate."
        value={proxySpec.secret}
        onChange={setSecret}
        readOnly={isReadonly}
      />
      <OptionalTextField
        label="Timeout"
        placeholder="30s"
        value={proxySpec.timeout}
        onChange={setTimeout}
        readOnly={isReadonly}
      />
      {testConnection !== undefined && (
        <Box display="flex" justifyContent="flex-end">
          <DatasourceTestConnectionButton testConnection={testConnection} disabled={proxySpec.url === ''} />
        </Box>
      )}
      <Typography variant="h5" component="h3">
        Allowed endpoints (GET only)
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Go regular expressions matched against the request path. Keep them anchored with ^ and $. Add one line per
        custom resource you read, e.g. ^/apis/example.com/v1/(namespaces/[a-z0-9]([-a-z0-9]*[a-z0-9])?/)?widgets$
      </Typography>
      <AllowedEndpointsEditor endpoints={endpoints} isReadonly={isReadonly} onChange={setEndpoints} />
      {problems.length > 0 && (
        <Alert severity="error" role="alert">
          {problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </Alert>
      )}
    </Stack>
  );
}
