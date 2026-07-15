export const isPlainObject = (item: unknown): item is Record<string, any> => {
  return !!item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Deep clones JSON-serializable values.
 * Safely skips functions and React components (copies by reference).
 */
const deepCloneJSON = <V>(val: V): V => {
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(deepCloneJSON) as unknown as V;
  }
  const cloned = {} as any;
  for (const key of Object.keys(val)) {
    cloned[key] = deepCloneJSON((val as any)[key]);
  }
  return cloned;
};

/**
 * Returns a refined type string for type safety checks.
 */
const getRefinedType = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isPlainObject(value)) return 'object';
  return typeof value;
};

/**
 * Recursively merges saved settings with default configuration.
 * - Handles adding new properties (falls back to cloned defaults).
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

    // 1. Addition: key is not present in saved settings -> copy deep clone of default
    if (savedValue === undefined) {
      result[key] = deepCloneJSON(defaultValue);
      continue;
    }

    // 2. Nested objects: recursively merge deeper
    if (isPlainObject(defaultValue) && isPlainObject(savedValue)) {
      result[key] = mergeWithDefaults(defaultValue, savedValue);
    }
    // 3. Arrays: replace defaults array completely with saved array (deep cloned)
    else if (Array.isArray(defaultValue) && Array.isArray(savedValue)) {
      result[key] = deepCloneJSON(savedValue);
    }
    // 4. Type safety check: if type has changed, reset to default value
    // (null is compatible with any type to support nullable fields)
    else {
      const defaultType = getRefinedType(defaultValue);
      const savedType = getRefinedType(savedValue);

      if (
        defaultType === savedType ||
        defaultType === 'null' ||
        savedType === 'null'
      ) {
        result[key] = deepCloneJSON(savedValue);
      } else {
        console.warn(
          `Setting type mismatch for "${key}": expected ${defaultType}, got ${savedType}. Resetting to default.`
        );
        result[key] = deepCloneJSON(defaultValue);
      }
    }
  }

  // All keys in `saved` that do not exist in `defaults` are automatically ignored (Deletion)
  return result;
};
