import { describe, expect, it } from 'vitest';

import { countryCodeForName } from './country-name';

describe('countryCodeForName', () => {
  it('reads the English name of a country', () => {
    expect(countryCodeForName('Germany')).toBe('de');
    expect(countryCodeForName('Japan')).toBe('jp');
    expect(countryCodeForName('Belgium')).toBe('be');
  });

  it('ignores case, accents and spaces around the name', () => {
    expect(countryCodeForName('  germany ')).toBe('de');
    expect(countryCodeForName('Turkiye')).toBe('tr');
  });

  it('knows the short and older names the sim may write', () => {
    expect(countryCodeForName('USA')).toBe('us');
    expect(countryCodeForName('UK')).toBe('gb');
    expect(countryCodeForName('Great Britain')).toBe('gb');
    expect(countryCodeForName('England')).toBe('gb-eng');
    expect(countryCodeForName('Czech Republic')).toBe('cz');
    expect(countryCodeForName('Turkey')).toBe('tr');
  });

  it('has no flag for a name it does not know or no name', () => {
    expect(countryCodeForName('Atlantis')).toBeNull();
    expect(countryCodeForName('')).toBeNull();
    expect(countryCodeForName(null)).toBeNull();
  });
});
