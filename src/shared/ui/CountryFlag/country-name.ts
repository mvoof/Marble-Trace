/**
 * A country as the sim names it in prose (`WeekendInfo.TrackCountry`, e.g.
 * "Germany") mapped to the ISO 3166 code the `flag-icons` sprite sheet is keyed
 * by. The English region names the browser knows cover most countries; the
 * table below adds the short and older names the sim, or the browser's own
 * newer naming, would otherwise miss.
 */
const NAME_ALIASES: Record<string, string> = {
  usa: 'us',
  'united states of america': 'us',
  uk: 'gb',
  'great britain': 'gb',
  england: 'gb-eng',
  scotland: 'gb-sct',
  wales: 'gb-wls',
  'northern ireland': 'gb-nir',
  'czech republic': 'cz',
  turkey: 'tr',
  korea: 'kr',
  'the netherlands': 'nl',
  holland: 'nl',
  uae: 'ae',
  macau: 'mo',
  macao: 'mo',
  'hong kong': 'hk',
  'ivory coast': 'ci',
};

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

const normalize = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

let namesToCodes: Map<string, string> | null = null;

/** Every two-letter region the browser has an English name for, by that name. */
const regionNames = (): Map<string, string> => {
  if (namesToCodes !== null) {
    return namesToCodes;
  }

  const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const names = new Map<string, string>();

  for (const first of ALPHABET) {
    for (const second of ALPHABET) {
      const code = `${first}${second}`;
      const name = displayNames.of(code.toUpperCase());

      // An unknown code comes back as itself.
      if (name !== undefined && name.toLowerCase() !== code) {
        names.set(normalize(name), code);
      }
    }
  }

  namesToCodes = names;

  return names;
};

export const countryCodeForName = (
  name: string | null | undefined
): string | null => {
  if (!name) {
    return null;
  }

  const normalized = normalize(name);

  return NAME_ALIASES[normalized] ?? regionNames().get(normalized) ?? null;
};
