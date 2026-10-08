import { createContext, use } from 'react';
import type { HudRoot } from './hud-root';

export const HudRootContext = createContext<HudRoot | null>(null);

export const useHudRoot = (): HudRoot => {
  const context = use(HudRootContext);

  if (!context) {
    throw new Error('Missing HudRootContext provider');
  }

  return context;
};

export const useDiagnosticsHudStore = () => useHudRoot().diagnosticsHud;
