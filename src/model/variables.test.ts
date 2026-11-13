import { vars } from '../test/fakes';
import { resolveNamespaces, resolveText, variablesIn } from './variables';

describe('variables', () => {
  it('treats empty and All as every namespace', () => {
    expect(resolveNamespaces(undefined, {})).toBeUndefined();
    expect(resolveNamespaces('  ', {})).toBeUndefined();
    expect(resolveNamespaces('$ns', vars({ ns: '$__all' }))).toBeUndefined();
    expect(resolveNamespaces('$ns', vars({ ns: ['$__all'] }))).toBeUndefined();
  });

  it('resolves fixed values, single and multi-value variables', () => {
    expect(resolveNamespaces('shop', {})).toEqual(['shop']);
    expect(resolveNamespaces('$ns', vars({ ns: 'shop' }))).toEqual(['shop']);
    expect(resolveNamespaces('${ns}', vars({ ns: ['a', 'b'] }))).toEqual(['a', 'b']);
    expect(resolveNamespaces('${ns:regex}, c, a', vars({ ns: ['a', 'b'] }))).toEqual(['a', 'b', 'c']);
  });

  it('fails when a variable has no value', () => {
    expect(() => resolveNamespaces('$missing', {})).toThrow('has no value');
  });

  it('replaces text and lists dependencies', () => {
    expect(resolveText('app=$app', vars({ app: 'web' }))).toBe('app=web');
    expect(resolveText('', {})).toBeUndefined();
    expect(variablesIn('$a', undefined, 'x=${b},y=$a')).toEqual(['a', 'b']);
  });
});

describe('resolveNamespaces with a custom all value', () => {
  it('treats * as all namespaces', () => {
    expect(resolveNamespaces('$namespace', vars({ namespace: '*' }))).toBeUndefined();
  });
});
