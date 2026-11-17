import { createContext, useContext } from 'react';

/**
 * Whether the bar shows icons only — the floating pill over the canvas. The
 * top bar drops its labels by width instead, in CSS.
 */
export const ToolbarCompactContext = createContext(false);

export const useToolbarCompact = (): boolean =>
  useContext(ToolbarCompactContext);
