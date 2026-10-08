/** The Vite mode `tauri:build:dev` builds its frontend in (`tauri.dev.conf.json`). */
const DEV_TOOLS_MODE = 'devtools';

/**
 * The developer tools in the settings — the telemetry inspector and the
 * snapshot export — ship in the same builds as the backend's `dev` feature:
 * `tauri:dev` (the Vite dev server) and `tauri:build:dev`. A release build
 * shows neither.
 */
export const hasDevTools =
  import.meta.env.DEV || import.meta.env.MODE === DEV_TOOLS_MODE;
