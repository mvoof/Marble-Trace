const makeMockWindow = (label: string) => ({
  label,
  listen: async (_event: string, _cb: unknown) => () => {},
  once: async (_event: string, _cb: unknown) => () => {},
  emit: async (_event: string, _payload?: unknown) => {},
  setPosition: async (_pos: unknown) => {},
  setSize: async (_size: unknown) => {},
  setIgnoreCursorEvents: async (_ignore: boolean) => {},
  startDragging: async () => {},
  minimize: async () => {},
  toggleMaximize: async () => {},
  isMaximized: async () => false,
  show: async () => {},
  hide: async () => {},
  close: async () => {},
});

export const getCurrentWindow = () => makeMockWindow('mock-window');

export const availableMonitors = async () => [];

export const primaryMonitor = async () => null;
