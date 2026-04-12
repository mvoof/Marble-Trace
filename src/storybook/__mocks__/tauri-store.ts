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

export const load = async (_path: string): Promise<Store> => new Store(_path);
