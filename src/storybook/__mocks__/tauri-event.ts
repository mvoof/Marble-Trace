export type UnlistenFn = () => void;

export const listen = async (
  _event: string,
  _callback: (event: unknown) => void
): Promise<UnlistenFn> => {
  return () => {};
};

export const emit = async (
  _event: string,
  _payload?: unknown
): Promise<void> => {};
