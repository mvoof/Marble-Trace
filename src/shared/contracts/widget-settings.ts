import type React from 'react';
import type { CapabilitiesPayload } from '@shared/contracts/bindings';
import type { TelemetryEventName } from '@shared/contracts/telemetry-events';
import type { PreviewScenarioId } from '@shared/contracts/preview-scenarios';

export interface WidgetMeta {
  /**
   * On a manifest, the widget's id. On a widget record, the *instance* id —
   * unique within its layout, since a monitor may hold several instances of
   * one widget (a big track map and an overview in the corner).
   */
  id: string;
  label: string;
  description?: string;
  designWidth: number;
  designHeight: number;
  autoHeight?: boolean;
  /**
   * The widget is as wide and as tall as what it draws — a column that
   * leaves the row narrows it — and paints its own plate
   * (`transparentContainer`). Its frame hugs the plate, and resizing can only
   * scale it, so only the corners are offered. Implies `autoHeight`.
   */
  contentSized?: boolean;
  overflowVisible?: boolean;
  transparentContainer?: boolean;
  /** Resize handles keep designWidth:designHeight ratio locked (e.g. a widget
   * with a circular badge sized off the height). */
  lockAspectRatio?: boolean;
  /** Widget scale (--wfs) follows the height instead of the width, and the
   * e/w handles only stretch the widget without rescaling it — for widgets
   * whose middle section (a chart) is meant to grow horizontally while the
   * fixed-size parts around it stay put. Corner handles still scale the whole
   * widget proportionally; there are no n/s handles. */
  scaleFromHeight?: boolean;
  requiredCapabilities?: (keyof CapabilitiesPayload)[];
}

/**
 * What the rest of the app reads off a widget's settings schema
 * (`shared/lib/widget-settings-dsl.ts`, `defineSettings`) — the file codec, the
 * catalog and Storybook — without knowing the widget.
 */
export interface WidgetSettingsSchema {
  /** The widget's block under `settingsPanels` in the locale files. */
  localeBlock: string;
  defaults: Readonly<Record<string, unknown>>;
  /** Members of every choice, by setting key. */
  selectOptions: Readonly<Record<string, readonly (string | number)[]>>;
  parseOverrides: (raw: Record<string, unknown>) => {
    overrides: Readonly<Record<string, unknown>>;
    rejected: string[];
  };
}

export interface BaseUserSettings {
  enabled: boolean;
  x: number;
  y: number;
  currentWidth: number;
  currentHeight: number;
  opacity: number;
  /** Multiplier applied to fs() font sizes only — independent of --wfs (width scale). */
  fontScale: number;
  backgroundColor: string;
  borderColor: string;
  zIndex?: number;
}

/**
 * A widget's settings as the app carries them: the ones every widget has, and
 * its own, which only its `settings-schema.ts` describes. Code that knows the
 * widget reads them through `getSettings<XWidgetSettings>()`.
 */
export type WidgetUserSettings = BaseUserSettings & Record<string, unknown>;

export interface LayoutChangeResult {
  designWidth?: number;
  designHeight?: number;
  currentWidth?: number;
  currentHeight?: number;
  userSettingsPatch?: Partial<WidgetUserSettings>;
}

export interface LayoutChangeContext {
  designWidth: number;
  designHeight: number;
  currentWidth: number;
  currentHeight: number;
}

export type ResolveLayoutChange = (
  prev: WidgetUserSettings,
  next: WidgetUserSettings,
  current: LayoutChangeContext
) => LayoutChangeResult | null;

/**
 * What a widget declares about itself, in its own `manifest.ts`. Plain data:
 * no React, so the catalog the stores read carries no UI with it. The id →
 * component map lives in `widgets/registry.ts`.
 */
export interface WidgetManifest extends WidgetMeta {
  userSettings: WidgetUserSettings;
  /**
   * The widget's own settings, described once in its `settings-schema.ts`.
   * `userSettings` spreads its `defaults`; the file codec checks a stored
   * override against it on load.
   */
  settingsSchema: WidgetSettingsSchema;
  resolveLayoutChange?: ResolveLayoutChange;
  /**
   * For a widget whose width is literally the sum of its columns (the standings
   * and relative tables), the design width the settings imply. The saved copy is
   * normalized against it on load: a stored width left by an older shape would
   * otherwise survive as dead space at the right edge of every row, since the
   * columns scale by `--wfs = currentWidth / designWidth` and fill the widget
   * exactly only while the two agree.
   */
  deriveDesignWidth?: (settings: WidgetUserSettings) => number;
  /**
   * High-frequency bundle fields this widget reads. The backend fills them only
   * while some enabled widget of the active layout asks for them — declaring
   * nothing means the widget lives on the fields that are always sent.
   *
   * Get this wrong in the omitting direction and the widget renders stale or
   * empty; in the adding direction it costs everyone else the traffic. Both are
   * why it belongs here rather than in a list somewhere else.
   */
  telemetryEvents?: TelemetryEventName[];
  /**
   * The preview scenarios of this widget's own domain — the states it can be in
   * that the driver does not control. Absent means the widget has no states of
   * its own and gets no scenario picker; its preview still renders against the
   * base snapshot.
   *
   * A state the widget's own settings can toggle gets no scenario: the toggle
   * governs whether a block is there, a scenario governs what data is in it.
   */
  previewScenarios?: PreviewScenarioId[];
  /**
   * Whether the baseline is one of the states this widget can be looked at in.
   *
   * The baseline car is a GT3, so a widget whose whole subject is hardware that
   * car does not carry renders nothing against it — correctly, but in the
   * workbench that is an empty pane on a widget the driver just clicked. Such a
   * widget sets this to false and its picker offers only the states it declares.
   *
   * Default (absent) is true: for every other widget the baseline is the state
   * to return to, and dropping it would strand the driver on the first scenario
   * they picked.
   */
  previewBaseline?: boolean;
}

export interface WidgetConfig extends WidgetManifest {
  component: React.ComponentType;
}

export type WidgetDefaultConfig = WidgetMeta & {
  /**
   * Which widget this is an instance of — the manifest id, and with it the
   * component, the shipped defaults and the layout resolver.
   */
  type: string;
  /**
   * Name of the layout monitor this instance belongs to. Ownership is this
   * field and nothing else — never the widget's position: a widget is kept
   * inside its monitor's bounds, and only "move to monitor" changes it.
   *
   * Absent only on records that stand on no monitor: the template catalogue
   * the Widgets page edits, and the stand-in map of a window with no layout.
   */
  monitor?: string;
  /**
   * Whether the widget's hotkeys act on this instance. Absent means the
   * default, which is on — for a browser screen too. Read it through
   * `hotkeysActOn`.
   */
  hotkeys?: boolean;
  userSettings: WidgetUserSettings;
};

export interface LayoutResolution {
  width: number;
  height: number;
}

/** A monitor's placement in virtual-desktop space, in logical (CSS) pixels. */
export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A monitor the layout is spread across. Added explicitly by the user — the
 * machine can have screens a layout ignores. Bounds are kept even while the
 * monitor is unplugged, so the editor can still show and edit that area.
 */
export interface LayoutMonitor {
  name: string;
  bounds: MonitorBounds;
  /**
   * A remote screen is a device on the network rendering the layout in a
   * browser. It behaves as a monitor everywhere it matters — it owns its own
   * widget set, the editor lays it out — but no overlay window is ever opened
   * for it. Absent means a physical
   * display, so files written before remote screens existed stay valid.
   */
  kind?: 'display' | 'remote';
  /** Remote screens only: the URL segment the device is opened at. */
  slug?: string;
  /**
   * Remote screens only: what the page paints behind the widgets — any CSS
   * color, or `'transparent'`.
   *
   * One screen serves both readers: a tablet wants a ground of its own, and an
   * OBS browser source wants none so the widgets composite over the game
   * capture below them. That is the only difference between the two, so it is a
   * setting rather than a kind of screen. Absent means the dark default.
   */
  background?: string;
  /**
   * Remote screens only: a device has already reported its size and the screen
   * was matched to it. The first connection fits the screen automatically —
   * the size picked when creating it is a guess — but only the first, so a
   * different device opening the same link, or a browser address bar coming
   * and going, cannot reshuffle a layout the user has already built.
   */
  fittedToDevice?: boolean;
}

export type SessionContext = 'Practice' | 'Qualify' | 'Race' | 'Garage';

export interface SavedLayout {
  id: string;
  name: string;
  createdAt: number;
  /** Background image per monitor name, drawn behind widgets in the editor. */
  backgroundImages?: Record<string, string>;
  /** Monitors this layout covers. One overlay window is opened per monitor. */
  monitors: LayoutMonitor[];
  /**
   * Every widget of the layout, positioned in virtual-desktop space while the
   * app runs. Each belongs to the monitor its `monitor` field names — on disk
   * they are stored nested under that monitor, in its own coordinates (see
   * `platform/sync/settings-file.ts`).
   *
   * A widget may appear more than once on a monitor: each entry is an
   * independent instance with its own geometry, settings and enabled flag,
   * keyed by its `id` and pointing at the shared manifest through `type`.
   */
  widgets: WidgetDefaultConfig[];
}
