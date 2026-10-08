const DEBUG = import.meta.env.DEV;

export const debug = {
  telemetry(msg: string, ...args: unknown[]) {
    if (DEBUG) console.log(`[telemetry] ${msg}`, ...args);
  },

  store(msg: string, ...args: unknown[]) {
    if (DEBUG) console.log(`[store] ${msg}`, ...args);
  },

  window(msg: string, ...args: unknown[]) {
    if (DEBUG) console.log(`[window] ${msg}`, ...args);
  },
};
