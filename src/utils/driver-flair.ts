/**
 * iRacing's `FlairID` — the country flag a driver picked for their profile —
 * mapped to the ISO 3166 code the `flag-icons` sprite sheet is keyed by. The
 * sim ships no country field of its own, so this table is the only way from a
 * driver entry to a flag; anything unlisted means "no flag".
 *
 * The country ids run 3..242 in alphabetical order; everything below that is a
 * flair iRacing offers that is not a country: `2` is the sim's "Global", drawn
 * with the UN flag as the sprite sheet's closest match, and `1` gets the
 * sheet's own "unknown flag" tile. `0` stays unmapped — it is what a driver who
 * picked nothing carries, and every AI entry with it.
 */
const FLAIR_ID_TO_COUNTRY_CODE: Record<number, string> = {
  1: 'xx', // unknown flag
  2: 'un', // "Global" in the sim
  3: 'af', // Afghanistan
  4: 'ax', // Åland Islands
  5: 'al', // Albania
  6: 'dz', // Algeria
  7: 'as', // American Samoa
  8: 'ad', // Andorra
  9: 'ao', // Angola
  10: 'ai', // Anguilla
  11: 'aq', // Antarctica
  12: 'ag', // Antigua and Barbuda
  13: 'ar', // Argentina
  14: 'am', // Armenia
  15: 'aw', // Aruba
  16: 'au', // Australia
  17: 'at', // Austria
  18: 'az', // Azerbaijan
  19: 'bs', // Bahamas
  20: 'bh', // Bahrain
  21: 'bd', // Bangladesh
  22: 'bb', // Barbados
  23: 'be', // Belgium
  24: 'bz', // Belize
  25: 'bj', // Benin
  26: 'bm', // Bermuda
  27: 'bt', // Bhutan
  28: 'bo', // Bolivia
  29: 'ba', // Bosnia and Herzegovina
  30: 'bw', // Botswana
  31: 'br', // Brazil
  32: 'vg', // British Virgin Islands
  33: 'bn', // Brunei Darussalam
  34: 'bg', // Bulgaria
  35: 'bf', // Burkina Faso
  36: 'bi', // Burundi
  37: 'kh', // Cambodia
  38: 'cm', // Cameroon
  39: 'ca', // Canada
  40: 'cv', // Cape Verde
  41: 'ky', // Cayman Islands
  42: 'cf', // Central African Republic
  43: 'td', // Chad
  44: 'cl', // Chile
  45: 'cn', // China
  46: 'cx', // Christmas Island
  47: 'cc', // Cocos (Keeling) Islands
  48: 'co', // Colombia
  49: 'km', // Comoros
  50: 'ck', // Cook Islands
  51: 'cr', // Costa Rica
  52: 'hr', // Croatia
  53: 'cy', // Cyprus
  54: 'cz', // Czechia
  55: 'cd', // Democratic Republic of the Congo
  56: 'dk', // Denmark
  57: 'dj', // Djibouti
  58: 'dm', // Dominica
  59: 'do', // Dominican Republic
  60: 'ec', // Ecuador
  61: 'eg', // Egypt
  62: 'sv', // El Salvador
  63: 'gq', // Equatorial Guinea
  64: 'er', // Eritrea
  65: 'ee', // Estonia
  66: 'et', // Ethiopia
  67: 'fk', // Falkland Islands
  68: 'fo', // Faroe Islands
  69: 'fj', // Fiji
  70: 'fi', // Finland
  71: 'fr', // France
  72: 'gf', // French Guiana
  73: 'pf', // French Polynesia
  74: 'ga', // Gabon
  75: 'gm', // Gambia
  76: 'ge', // Georgia
  77: 'de', // Germany
  78: 'gh', // Ghana
  79: 'gi', // Gibraltar
  80: 'gr', // Greece
  81: 'gl', // Greenland
  82: 'gd', // Grenada
  83: 'gp', // Guadeloupe
  84: 'gu', // Guam
  85: 'gt', // Guatemala
  86: 'gg', // Guernsey
  87: 'gn', // Guinea
  88: 'gw', // Guinea-Bissau
  89: 'gy', // Guyana
  90: 'ht', // Haiti
  91: 'hn', // Honduras
  92: 'hk', // Hong Kong
  93: 'hu', // Hungary
  94: 'is', // Iceland
  95: 'in', // India
  96: 'id', // Indonesia
  97: 'iq', // Iraq
  98: 'ie', // Ireland
  99: 'im', // Isle of Man
  100: 'il', // Israel
  101: 'it', // Italy
  102: 'ci', // Ivory Coast
  103: 'jm', // Jamaica
  104: 'jp', // Japan
  105: 'je', // Jersey
  106: 'jo', // Jordan
  107: 'kz', // Kazakhstan
  108: 'ke', // Kenya
  109: 'ki', // Kiribati
  110: 'kw', // Kuwait
  111: 'kg', // Kyrgyzstan
  112: 'la', // Laos
  113: 'lv', // Latvia
  114: 'lb', // Lebanon
  115: 'ls', // Lesotho
  116: 'lr', // Liberia
  117: 'ly', // Libya
  118: 'li', // Liechtenstein
  119: 'lt', // Lithuania
  120: 'lu', // Luxembourg
  121: 'mo', // Macau
  122: 'mk', // Macedonia
  123: 'mg', // Madagascar
  124: 'mw', // Malawi
  125: 'my', // Malaysia
  126: 'mv', // Maldives
  127: 'ml', // Mali
  128: 'mt', // Malta
  129: 'mh', // Marshall Islands
  130: 'mq', // Martinique
  131: 'mr', // Mauritania
  132: 'mu', // Mauritius
  133: 'yt', // Mayotte
  134: 'mx', // Mexico
  135: 'fm', // Micronesia
  136: 'md', // Moldova
  137: 'mc', // Monaco
  138: 'mn', // Mongolia
  139: 'me', // Montenegro
  140: 'ms', // Montserrat
  141: 'ma', // Morocco
  142: 'mz', // Mozambique
  143: 'na', // Namibia
  144: 'nr', // Nauru
  145: 'np', // Nepal
  146: 'nl', // Netherlands
  148: 'nc', // New Caledonia
  149: 'nz', // New Zealand
  150: 'ni', // Nicaragua
  151: 'ne', // Niger
  152: 'ng', // Nigeria
  153: 'nu', // Niue
  154: 'nf', // Norfolk Island
  155: 'mp', // Northern Mariana Islands
  156: 'no', // Norway
  157: 'om', // Oman
  158: 'pk', // Pakistan
  159: 'pw', // Palau
  160: 'ps', // Palestine
  161: 'pa', // Panama
  162: 'pg', // Papua New Guinea
  163: 'py', // Paraguay
  164: 'pe', // Peru
  165: 'ph', // Philippines
  166: 'pn', // Pitcairn Islands
  167: 'pl', // Poland
  168: 'pt', // Portugal
  169: 'pr', // Puerto Rico
  170: 'qa', // Qatar
  171: 'cg', // Republic of the Congo
  172: 're', // Reunion
  173: 'ro', // Romania
  174: 'rw', // Rwanda
  175: 'sh', // Saint Helena
  176: 'kn', // Saint Kitts and Nevis
  177: 'lc', // Saint Lucia
  178: 'pm', // Saint Pierre & Miquelon
  179: 'vc', // Saint Vincent and the Grenadines
  180: 'bl', // Saint-Barthélemy
  181: 'mf', // Saint-Martin
  182: 'ws', // Samoa
  183: 'sm', // San Marino
  184: 'st', // Sao Tome and Principe
  185: 'sa', // Saudi Arabia
  186: 'sn', // Senegal
  187: 'rs', // Serbia
  188: 'sc', // Seychelles
  189: 'sl', // Sierra Leone
  190: 'sg', // Singapore
  191: 'sk', // Slovakia
  192: 'si', // Slovenia
  193: 'sb', // Solomon Islands
  194: 'so', // Somalia
  195: 'za', // South Africa
  196: 'gs', // South Georgia & South Sandwich Islands
  197: 'kr', // South Korea
  198: 'es', // Spain
  199: 'lk', // Sri Lanka
  200: 'sr', // Suriname
  201: 'sj', // Svalbard
  202: 'sz', // Eswatini
  203: 'se', // Sweden
  204: 'ch', // Switzerland
  205: 'tw', // Taiwan
  206: 'tj', // Tajikistan
  207: 'tz', // Tanzania
  208: 'th', // Thailand
  209: 'tl', // Timor-Leste
  210: 'tg', // Togo
  211: 'tk', // Tokelau
  212: 'to', // Tonga
  213: 'tt', // Trinidad and Tobago
  214: 'tn', // Tunisia
  215: 'tr', // Türkiye
  216: 'tm', // Turkmenistan
  217: 'tc', // Turks and Caicos Islands
  218: 'tv', // Tuvalu
  219: 'ug', // Uganda
  220: 'ua', // Ukraine
  221: 'ae', // United Arab Emirates
  222: 'gb', // United Kingdom
  223: 'us', // United States
  224: 'uy', // Uruguay
  225: 'uz', // Uzbekistan
  226: 'vu', // Vanuatu
  227: 'va', // Vatican City
  228: 've', // Venezuela
  229: 'vn', // Vietnam
  230: 'vi', // Virgin Islands
  231: 'wf', // Wallis and Futuna
  232: 'eh', // Western Sahara
  233: 'ye', // Yemen
  234: 'zm', // Zambia
  235: 'zw', // Zimbabwe
  236: 'gb-eng', // England
  237: 'gb-sct', // Scotland
  238: 'gb-wls', // Wales
  239: 'gb-nir', // Northern Ireland
  240: 'bq', // Bonaire, Sint Eustatius and Saba
  241: 'cw', // Curaçao
  242: 'sx', // Sint Maarten (Dutch part)
};

export const countryCodeForFlairId = (
  flairId: number | null | undefined
): string | null => {
  if (flairId == null) {
    return null;
  }

  return FLAIR_ID_TO_COUNTRY_CODE[flairId] ?? null;
};
