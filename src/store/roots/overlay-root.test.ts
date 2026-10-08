import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverlayRoot } from './overlay-root';
import { MainRoot } from './main-root';
import { RendererCore } from './renderer-core';

/**
 * Every store only the main window (or the banner window) uses, wrapped so a
 * construction is recorded. Hoisted: `vi.mock` factories run while the roots
 * above are imported, before any module-level code of this file.
 */
const { constructed, tracked } = vi.hoisted(() => {
  const constructedNames = new Set<string>();

  // A wrapper rather than a subclass: `makeAutoObservable` refuses a subclassed
  // store. A constructor function that returns an object hands that object to
  // `new`, so the store is the real one.
  const trackConstruction = <Store extends new (...args: never[]) => object>(
    name: string,
    Original: Store
  ): Store =>
    new Proxy(Original, {
      construct: (target, args) => {
        constructedNames.add(name);

        return new target(...(args as never[]));
      },
    });

  return { constructed: constructedNames, tracked: trackConstruction };
});

vi.mock(
  '@features/layout-editor/layout-editor.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/layout-editor/layout-editor.store')
      >();

    return {
      ...actual,
      LayoutEditorStore: tracked('LayoutEditorStore', actual.LayoutEditorStore),
    };
  }
);

vi.mock(
  '@features/companion-apps/companion-apps.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/companion-apps/companion-apps.store')
      >();

    return {
      ...actual,
      CompanionAppsStore: tracked(
        'CompanionAppsStore',
        actual.CompanionAppsStore
      ),
    };
  }
);

vi.mock('@features/twitch-auth/twitch-auth.store', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@features/twitch-auth/twitch-auth.store')
    >();

  return {
    ...actual,
    TwitchAuthStore: tracked('TwitchAuthStore', actual.TwitchAuthStore),
  };
});

vi.mock(
  '@features/hotkey-bindings/device-input.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/hotkey-bindings/device-input.store')
      >();

    return {
      ...actual,
      DeviceInputStore: tracked('DeviceInputStore', actual.DeviceInputStore),
    };
  }
);

vi.mock(
  '@features/hotkey-bindings/bindings-ui.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/hotkey-bindings/bindings-ui.store')
      >();

    return {
      ...actual,
      BindingsUiStore: tracked('BindingsUiStore', actual.BindingsUiStore),
    };
  }
);

vi.mock(
  '@features/remote-screens/remote-devices.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/remote-screens/remote-devices.store')
      >();

    return {
      ...actual,
      RemoteDevicesStore: tracked(
        'RemoteDevicesStore',
        actual.RemoteDevicesStore
      ),
    };
  }
);

vi.mock(
  '@features/diagnostics/fps-diagnostics.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/diagnostics/fps-diagnostics.store')
      >();

    return {
      ...actual,
      FpsDiagnosticsStore: tracked(
        'FpsDiagnosticsStore',
        actual.FpsDiagnosticsStore
      ),
    };
  }
);

vi.mock(
  '@features/diagnostics/diagnostics-export.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/diagnostics/diagnostics-export.store')
      >();

    return {
      ...actual,
      DiagnosticsExportStore: tracked(
        'DiagnosticsExportStore',
        actual.DiagnosticsExportStore
      ),
    };
  }
);

vi.mock(
  '@features/telemetry-inspector/telemetry-inspector.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/telemetry-inspector/telemetry-inspector.store')
      >();

    return {
      ...actual,
      TelemetryInspectorStore: tracked(
        'TelemetryInspectorStore',
        actual.TelemetryInspectorStore
      ),
    };
  }
);

vi.mock(
  '@features/diagnostics/diagnostics-hud.store',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@features/diagnostics/diagnostics-hud.store')
      >();

    return {
      ...actual,
      DiagnosticsHudStore: tracked(
        'DiagnosticsHudStore',
        actual.DiagnosticsHudStore
      ),
    };
  }
);

vi.mock('@entities/track/track-rotation.store', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@entities/track/track-rotation.store')
    >();

  return {
    ...actual,
    TrackRotationStore: tracked(
      'TrackRotationStore',
      actual.TrackRotationStore
    ),
  };
});

const MAIN_ONLY_STORES = [
  'LayoutEditorStore',
  'CompanionAppsStore',
  'TwitchAuthStore',
  'DeviceInputStore',
  'BindingsUiStore',
  'RemoteDevicesStore',
  'FpsDiagnosticsStore',
  'DiagnosticsExportStore',
  'TelemetryInspectorStore',
  'TrackRotationStore',
];

describe('window roots', () => {
  beforeEach(() => {
    constructed.clear();
  });

  // `skipInit` only skips the Tauri channels the init opens; every store is
  // still constructed, which is what this counts.
  it('an overlay constructs none of the main-only stores', () => {
    const overlay = new OverlayRoot({ skipInit: true });

    expect([...constructed]).toEqual([]);
    expect(overlay.bindings).toBeDefined();
    expect(overlay.settingsPanelUi).toBeDefined();
    // @ts-expect-error — the editor is not on an overlay's root, by type
    expect(overlay.layoutEditor).toBeUndefined();
    // @ts-expect-error — nor the inspector
    expect(overlay.telemetryInspector).toBeUndefined();
  });

  // ADR-0007: an overlay changes a setting only by command, so a write reached
  // from its root is a compile error rather than a silent fork of main.
  it('reaches no settings write on the widget store, by type', () => {
    const overlay = new OverlayRoot({ skipInit: true });

    // @ts-expect-error — a drag is a command (`settingsClient.moveWidget`)
    expect(typeof overlay.liveWidgets.updatePosition).toBe('function');
    // @ts-expect-error — a popup edit is a command (`settingsClient.patchSettings`)
    expect(typeof overlay.liveWidgets.updateUserSettings).toBe('function');
    // @ts-expect-error — the F9 picker is a command too
    expect(typeof overlay.liveWidgets.setTypeEnabledOnMonitor).toBe('function');
  });

  it('a preview core constructs none of them either', () => {
    const preview = new RendererCore({ skipInit: true });

    expect([...constructed]).toEqual([]);
    // @ts-expect-error — the bindings belong to the app windows
    expect(preview.bindings).toBeUndefined();
  });

  it('the main window constructs exactly the main-only stores', () => {
    new MainRoot({ skipInit: true });

    expect([...constructed].sort()).toEqual([...MAIN_ONLY_STORES].sort());
  });
});
