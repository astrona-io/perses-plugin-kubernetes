import { fireEvent, render, screen } from '@testing-library/react';

import { KubernetesDatasourceEditor } from './datasources/kubernetes-datasource';
import { DEFAULT_ALLOWED_ENDPOINTS } from './datasources/kubernetes-datasource/allowed-endpoints';
import type { KubernetesDatasourceSpec } from './datasources/kubernetes-datasource/kubernetes-datasource-types';
import { KubernetesEventsQueryEditor } from './queries/kubernetes-events-query/KubernetesEventsQueryEditor';
import { KubernetesStateQueryEditor } from './queries/kubernetes-state-query/KubernetesStateQueryEditor';
import { KubernetesResourceVariableEditor } from './variables/kubernetes-resource-variable/KubernetesResourceVariableEditor';

vi.mock('@perses-dev/plugin-system', async () => (await import('./test/mock-plugin-system')).mockPluginSystem());

const dsSpec = (allowedEndpoints = DEFAULT_ALLOWED_ENDPOINTS): KubernetesDatasourceSpec => ({
  proxy: {
    kind: 'HTTPProxy',
    spec: {
      url: 'https://kubernetes.default.svc',
      secret: 'kubernetes',
      allowedEndpoints,
    },
  },
});

describe('KubernetesDatasourceEditor', () => {
  it('shows the proxy fields and the allow-list', () => {
    render(<KubernetesDatasourceEditor value={dsSpec()} onChange={vi.fn()} />);
    expect(screen.getByLabelText('API server URL')).toHaveValue('https://kubernetes.default.svc');
    expect(screen.getByLabelText('Secret')).toHaveValue('kubernetes');
    expect(screen.getByLabelText('Pattern 1')).toHaveValue(DEFAULT_ALLOWED_ENDPOINTS[0]?.endpointPattern);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns about an unsafe allow-list', () => {
    render(
      <KubernetesDatasourceEditor value={dsSpec([{ endpointPattern: '/api', method: 'GET' }])} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('anchored');
  });

  it('edits the URL, adds a pattern and resets to defaults', () => {
    const onChange = vi.fn();
    render(<KubernetesDatasourceEditor value={dsSpec([])} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('API server URL'), {
      target: { value: 'https://k8s.example:6443' },
    });
    expect(onChange.mock.lastCall?.[0].proxy.spec.url).toBe('https://k8s.example:6443');
    fireEvent.click(screen.getByText('Reset to defaults'));
    expect(onChange.mock.lastCall?.[0].proxy.spec.allowedEndpoints).toEqual(DEFAULT_ALLOWED_ENDPOINTS);
    fireEvent.click(screen.getByText('Add pattern'));
    expect(onChange.mock.lastCall?.[0].proxy.spec.allowedEndpoints).toHaveLength(1);
  });

  it('is read-only when asked', () => {
    render(<KubernetesDatasourceEditor value={dsSpec()} onChange={vi.fn()} isReadonly />);
    expect(screen.getByLabelText('API server URL')).toHaveAttribute('readonly');
  });
});

describe('KubernetesResourceVariableEditor', () => {
  it('edits every option', () => {
    const onChange = vi.fn();
    render(<KubernetesResourceVariableEditor value={{ resource: 'pods' }} onChange={onChange} />);
    const cases: Array<[string, string, string]> = [
      ['Namespace', '$namespace', 'namespace'],
      ['Label selector', 'app=web', 'labelSelector'],
      ['Field selector', 'status.phase=Running', 'fieldSelector'],
      ['Value field', '.spec.nodeName', 'valueField'],
      ['Label field', '.metadata.name', 'labelField'],
      ['Filter', '^web', 'filter'],
    ];
    for (const [label, value, key] of cases) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      expect(onChange.mock.lastCall?.[0]).toMatchObject({
        resource: 'pods',
        [key]: value,
      });
    }
  });

  it('flags an invalid JSONPath and regex', () => {
    render(
      <KubernetesResourceVariableEditor
        value={{ resource: 'pods', valueField: 'metadata', filter: '(' }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Value field')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Filter')).toHaveAttribute('aria-invalid', 'true');
  });

  it('hides the namespace for cluster-scoped resources', () => {
    render(<KubernetesResourceVariableEditor value={{ resource: 'nodes' }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Namespace')).toBeNull();
  });
});

describe('KubernetesStateQueryEditor', () => {
  it('edits the state field and resets a custom mapping', () => {
    const onChange = vi.fn();
    render(
      <KubernetesStateQueryEditor
        value={{ resource: 'pods', stateMapping: [{ value: 'X', code: 1 }] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('State field'), {
      target: { value: '.status.reason' },
    });
    expect(onChange.mock.lastCall?.[0].stateField).toBe('.status.reason');
    fireEvent.click(screen.getByText('Reset to defaults'));
    expect(onChange.mock.lastCall?.[0].stateMapping).toBeUndefined();
  });
});

describe('KubernetesEventsQueryEditor', () => {
  it('edits the filters', () => {
    const onChange = vi.fn();
    render(<KubernetesEventsQueryEditor value={{}} onChange={onChange} />);
    const cases: Array<[string, string, string]> = [
      ['Namespace', 'shop', 'namespace'],
      ['Object kind', 'Pod', 'involvedObjectKind'],
      ['Object name', '$pod', 'involvedObjectName'],
      ['Reason', 'BackOff|Failed', 'reason'],
    ];
    for (const [label, value, key] of cases) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      expect(onChange.mock.lastCall?.[0]).toMatchObject({ [key]: value });
    }
    fireEvent.change(screen.getByLabelText('Limit'), {
      target: { value: '50' },
    });
    expect(onChange.mock.lastCall?.[0].limit).toBe(50);
  });
});
