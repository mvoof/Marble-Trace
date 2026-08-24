import type { ComponentType } from 'react';

/**
 * Which settings panel configures each widget id, collected from the panels
 * themselves: every panel exports the ids it covers (`PANEL_WIDGET_IDS`), and
 * a widget without one simply has no extra section.
 *
 * Collected rather than listed so a new widget's panel is one new file — the
 * chain of `widgetId === '…' && <Panel/>` this replaces was a shared file every
 * widget branch had to edit, and therefore conflict on.
 *
 * A panel is always passed `widgetId`; the two that serve a pair of widgets
 * (radar, flags) read it, the rest ignore it.
 *
 * Kept out of `mount.ts` on purpose: the remote screen renders widgets through
 * the widget registry and must stay a plain browser page, so a mount that
 * carried its Ant Design settings panel would ship the whole main-window
 * settings UI to every phone on the LAN.
 */
interface PanelModule {
  PANEL_WIDGET_IDS?: string[];
  [exportName: string]: unknown;
}

export type SettingsPanel = ComponentType<{ widgetId: string }>;

const panelModules = import.meta.glob<PanelModule>('./*SettingsPanel.tsx', {
  eager: true,
});

const panelOf = (module: PanelModule): SettingsPanel | undefined =>
  Object.entries(module).find(
    ([exportName]) => exportName !== 'PANEL_WIDGET_IDS'
  )?.[1] as SettingsPanel | undefined;

export const SETTINGS_PANELS: Record<string, SettingsPanel> =
  Object.fromEntries(
    Object.values(panelModules).flatMap((module) => {
      const panel = panelOf(module);

      if (!panel || !module.PANEL_WIDGET_IDS) {
        return [];
      }

      return module.PANEL_WIDGET_IDS.map((widgetId) => [widgetId, panel]);
    })
  );

export const settingsPanelForWidget = (
  widgetId: string
): SettingsPanel | undefined => SETTINGS_PANELS[widgetId];
