const storeCache = new Map<string, Store>();

export class Store {
  private data: Map<string, unknown> = new Map();

  constructor(_path: string) {}

  get = async <T>(key: string): Promise<T | null> =>
    (this.data.get(key) as T) ?? null;

  set = async (key: string, value: unknown) => {
    this.data.set(key, value);
  };

  save = async () => {};
}

export const load = async (path: string): Promise<Store> => {
  if (!storeCache.has(path)) storeCache.set(path, new Store(path));
  return storeCache.get(path)!;
};

/**
 * Pre-populate a mock store before a widget mounts.
 * Call this in a story's setup (before rendering the widget).
 */
export const preloadStore = async (
  path: string,
  key: string,
  value: unknown
): Promise<void> => {
  const store = await load(path);
  await store.set(key, value);
};

/**
 * Reset all mock stores — useful in story cleanup to avoid bleed between stories.
 */
export const resetStores = (): void => {
  storeCache.clear();
};
