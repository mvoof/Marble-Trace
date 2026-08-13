const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta'];

/**
 * Turns a browser KeyboardEvent into the accelerator syntax Tauri registers.
 *
 * Shared by the capture modal and the search-by-key field on purpose: if the
 * two spelled a key differently, searching for the key you just bound would
 * find nothing.
 *
 * Returns null for a bare modifier, which is not an accelerator on its own.
 */
export const toAccelerator = (event: KeyboardEvent): string | null => {
  if (MODIFIER_KEYS.includes(event.key)) return null;

  let mainKey = event.code.toUpperCase();

  if (event.code === 'Enter') {
    mainKey = 'RETURN';
  } else if (event.code.startsWith('Key')) {
    mainKey = event.key.toUpperCase();
  } else if (event.code.startsWith('Digit')) {
    mainKey = event.key;
  }

  const parts: string[] = [];

  if (event.ctrlKey) parts.push('Control');

  if (event.shiftKey) parts.push('Shift');

  if (event.altKey) parts.push('Alt');

  if (event.metaKey) parts.push('Super');

  parts.push(mainKey);

  return parts.join('+');
};
