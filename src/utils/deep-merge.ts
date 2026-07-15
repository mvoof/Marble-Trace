export const isPlainObject = (item: unknown): item is Record<string, any> => {
  return !!item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Recursively merges saved settings with default configuration.
 * - Handles adding new properties (falls back to defaults).
 * - Handles removing deprecated properties (prunes keys not present in defaults).
 * - Resets values to defaults if types mismatch (schema change protection).
 */
export const mergeWithDefaults = <T extends Record<string, any>>(
  defaults: T,
  saved: Record<string, any>
): T => {
  const result = { ...defaults } as any;

  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const savedValue = saved[key];

    // 1. Addition: key is not present in saved settings -> keep default value
    if (savedValue === undefined) {
      continue;
    }

    // 2. Nested objects: recursively merge deeper
    if (isPlainObject(defaultValue) && isPlainObject(savedValue)) {
      result[key] = mergeWithDefaults(defaultValue, savedValue);
    }
    // 3. Arrays: replace defaults array completely with saved array
    else if (Array.isArray(defaultValue) && Array.isArray(savedValue)) {
      result[key] = savedValue;
    }
    // 4. Type safety check: if type has changed, reset to default value
    // (null is compatible with any type to support nullable fields)
    else if (
      defaultValue === null ||
      savedValue === null ||
      typeof defaultValue === typeof savedValue
    ) {
      result[key] = savedValue;
    } else {
      console.warn(
        `Setting type for "${key}" changed from ${typeof savedValue} to ${typeof defaultValue}. Resetting to default.`
      );
    }
  }

  // All keys in `saved` that do not exist in `defaults` are automatically ignored (Deletion)
  return result;
};
