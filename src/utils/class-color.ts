/**
 * Convert iRacing CarClassColor (e.g. "0xff8800") to a CSS hex color.
 * Returns a neutral gray when the input is null/empty.
 */
export const parseClassColor = (raw: string | null | undefined): string => {
  if (!raw) return '#888888';
  return `#${raw.replace(/^0x/i, '')}`;
};
