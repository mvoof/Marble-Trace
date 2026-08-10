export class WebviewWindow {
  constructor(_label: string, _options?: unknown) {}
  listen = async (_event: string, _callback: unknown) => () => {};
  once = async (_event: string, _callback: unknown) => () => {};
  emit = async (_event: string, _payload?: unknown) => {};
  setPosition = async (_pos: unknown) => {};
  setSize = async (_size: unknown) => {};
  setIgnoreCursorEvents = async (_ignore: boolean) => {};
  startDragging = async () => {};
  show = async () => {};
  hide = async () => {};
  close = async () => {};
  static getByLabel = (_label: string) => null;
}

const makeMockWindow = (label: string) => ({
  listen: async (_event: string, _cb: unknown) => () => {},
  once: async (_event: string, _cb: unknown) => () => {},
  emit: async (_event: string, _payload?: unknown) => {},
  setIgnoreCursorEvents: async (_ignore: boolean) => {},
  startDragging: async () => {},
  label,
});

export const getCurrent = () => makeMockWindow('mock-window');

export const getCurrentWebviewWindow = () => makeMockWindow('mock-window');

export const getAllWebviewWindows = async () => [makeMockWindow('mock-window')];
