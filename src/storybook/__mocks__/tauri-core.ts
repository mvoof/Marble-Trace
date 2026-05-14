export const invoke = async (
  _cmd: string,
  _args?: unknown
): Promise<unknown> => {
  return null;
};

export class Resource {
  rid: number = 0;
}

export class Channel<T = unknown> {
  id: number = 0;
  onmessage: ((response: T) => void) | null = null;
}
