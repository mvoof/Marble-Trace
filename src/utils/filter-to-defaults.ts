export const filterToDefaults = <T extends object>(
  defaults: T,
  saved: Partial<T>
): T => {
  const result = { ...defaults };

  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (key in saved) {
      result[key] = saved[key] as T[typeof key];
    }
  }

  return result;
};
