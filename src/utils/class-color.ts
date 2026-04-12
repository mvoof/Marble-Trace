/**
 * Convert iRacing CarClassColor (e.g. "0xff8800") to a CSS hex color.
 * Returns a neutral gray when the input is null/empty.
 */
export const parseClassColor = (raw: string | null | undefined): string => {
  if (!raw) return '#888888';
  return `#${raw.replace(/^0x/i, '')}`;
};

/**
 * Default fallback class colors for sessions where iRacing does not expose
 * CarClassColor. Picks a stable hue per class id.
 */
const FALLBACK_CLASS_COLORS = [
  '#fbbf24',
  '#60a5fa',
  '#22c55e',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fb923c',
];

export const fallbackClassColor = (classId: number): string => {
  if (classId < 0) return '#888';
  return FALLBACK_CLASS_COLORS[classId % FALLBACK_CLASS_COLORS.length];
};

/**
 * Detect a category tag (GT3, GT4, LMP2, etc.) inside a car screen name.
 */
const CATEGORY_REGEX = /\b(GTP|LMP1|LMP2|LMP3|GTE|GT3|GT4|GT2|TCR|CUP)\b/i;

const deriveClassFromCar = (carName: string | null | undefined): string => {
  if (!carName) return '';
  const m = CATEGORY_REGEX.exec(carName);
  return m ? m[1].toUpperCase() : '';
};

/**
 * Build a short class label from iRacing data. Guarantees a non-empty string.
 *
 * Fallback chain:
 * 1. CarClassShortName (cleaned)
 * 2. Category regex on CarScreenName (GT3, LMP2, etc.)
 * 3. First word of CarScreenName (e.g. "Ferrari")
 * 4. "C{classId}"
 */
export const formatClassShortName = (
  rawClassName: string | null | undefined,
  carScreenName?: string | null,
  classId?: number
): string => {
  if (rawClassName) {
    const trimmed = rawClassName.replace(/\s*class\s*$/i, '').trim();

    if (/^class\s+\d+$/i.test(rawClassName.trim())) {
      const fromCar = deriveClassFromCar(carScreenName);
      if (fromCar) return fromCar;
      const m = /^class\s+(\d+)$/i.exec(rawClassName.trim());
      return m ? `C${m[1]}` : trimmed;
    }

    if (trimmed) return trimmed;
  }

  const fromCar = deriveClassFromCar(carScreenName);
  if (fromCar) return fromCar;

  if (carScreenName) {
    const firstWord = carScreenName.split(/\s+/)[0];
    if (firstWord && firstWord.length <= 8) return firstWord;
    if (firstWord) return firstWord.slice(0, 6);
  }

  if (classId != null && classId >= 0) return `C${classId}`;

  return 'Class';
};
