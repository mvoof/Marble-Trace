import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGET_BY_ID } from '@store/layout/widget-catalog';
import type {
  LayoutMonitor,
  SavedLayout,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import {
  decodeLayout,
  decodeTemplates,
  decodeWidget,
  encodeLayout,
  encodeTemplates,
  encodeWidget,
  type StoredWidget,
} from './settings-file';

const CHAT = 'stream-chat';
const FLAG = 'showPlaceholder';

const LEFT: LayoutMonitor = {
  name: 'LEFT',
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
};
const RIGHT: LayoutMonitor = {
  name: 'RIGHT',
  bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
};

// The settings of one widget differ per widget, so the union has no index
// signature. A test that pokes at one key by name reads them as a plain bag.
const settingsBag = (widget: WidgetDefaultConfig): Record<string, unknown> =>
  widget.userSettings as unknown as Record<string, unknown>;

const shipped = (type: string): WidgetDefaultConfig => {
  const record = DEFAULT_WIDGET_BY_ID.get(type);

  if (!record) {
    throw new Error(`the catalog ships no ${type}`);
  }

  return record;
};

const instanceOf = (
  type: string,
  overrides: Partial<WidgetDefaultConfig> = {},
  userSettings: Record<string, unknown> = {}
): WidgetDefaultConfig =>
  ({
    ...shipped(type),
    ...overrides,
    userSettings: { ...shipped(type).userSettings, ...userSettings },
  }) as WidgetDefaultConfig;

const storedChat = (
  settings: Record<string, unknown> = {},
  extra: Partial<StoredWidget> = {}
): StoredWidget => ({
  id: CHAT,
  type: CHAT,
  enabled: true,
  frame: { x: 10, y: 20, width: 300, height: 200 },
  settings,
  ...extra,
});

describe('a widget on disk', () => {
  it('stands in its monitor’s own coordinates', () => {
    const encoded = encodeWidget(
      instanceOf(CHAT, { monitor: 'RIGHT' }, { x: 2000, y: 50, zIndex: 4 }),
      RIGHT.bounds
    );

    expect(encoded.frame).toMatchObject({ x: 80, y: 50, z: 4 });
  });

  it('writes only the settings that differ from the manifest', () => {
    const encoded = encodeWidget(
      instanceOf(CHAT, {}, { [FLAG]: !settingsBag(shipped(CHAT))[FLAG] }),
      LEFT.bounds
    );

    expect(encoded.settings).toEqual({
      [FLAG]: !settingsBag(shipped(CHAT))[FLAG],
    });
  });

  it('writes no geometry into the settings', () => {
    const encoded = encodeWidget(
      instanceOf(CHAT, {}, { x: 1, y: 2, currentWidth: 3, enabled: false }),
      LEFT.bounds
    );

    expect(encoded.settings).toEqual({});
    expect(encoded.enabled).toBe(false);
  });

  it('writes no design size the manifest already gives', () => {
    expect(encodeWidget(instanceOf(CHAT), LEFT.bounds)).not.toHaveProperty(
      'design'
    );
  });

  // An orientation switch sets a design size no manifest field holds; leaving
  // it out would draw the widget in the other orientation's box.
  it('writes a design size the widget was switched onto', () => {
    const map = shipped('relative-map');
    const encoded = encodeWidget(
      instanceOf('relative-map', {
        designWidth: map.designHeight,
        designHeight: map.designWidth,
      }),
      LEFT.bounds
    );

    expect(encoded.design).toEqual({
      width: map.designHeight,
      height: map.designWidth,
    });
  });
});

describe('a widget read back', () => {
  it('lands on its monitor in desktop-wide coordinates', () => {
    const widget = decodeWidget(storedChat(), RIGHT)!;

    expect(widget.monitor).toBe('RIGHT');
    expect(widget.userSettings).toMatchObject({
      x: 1930,
      y: 20,
      currentWidth: 300,
      currentHeight: 200,
      enabled: true,
    });
  });

  it('fills every setting the file does not hold from the manifest', () => {
    const widget = decodeWidget(storedChat(), LEFT)!;

    expect(settingsBag(widget)[FLAG]).toBe(settingsBag(shipped(CHAT))[FLAG]);
  });

  it('keeps a value the user chose over the shipped default', () => {
    const chosen = !settingsBag(shipped(CHAT))[FLAG];
    const widget = decodeWidget(storedChat({ [FLAG]: chosen }), LEFT)!;

    expect(settingsBag(widget)[FLAG]).toBe(chosen);
  });

  it('takes its label and flags from the manifest', () => {
    const widget = decodeWidget(storedChat(), LEFT)!;

    expect(widget.label).toBe(shipped(CHAT).label);
    expect(widget.type).toBe(CHAT);
  });

  it('keeps an instance id that is not its type', () => {
    const widget = decodeWidget(storedChat({}, { id: 'stream-chat-2' }), LEFT)!;

    expect(widget.id).toBe('stream-chat-2');
    expect(widget.type).toBe(CHAT);
  });

  it('is dropped when the build no longer ships its widget', () => {
    expect(
      decodeWidget(storedChat({}, { type: 'retired-widget' }), LEFT)
    ).toBeNull();
  });

  it('falls back to the manifest for a frame field the file lacks', () => {
    const widget = decodeWidget(
      storedChat({}, { frame: { x: 5 } as StoredWidget['frame'] }),
      RIGHT
    )!;

    expect(widget.userSettings).toMatchObject({
      x: 1925,
      y: RIGHT.bounds.y + shipped(CHAT).userSettings.y,
      currentWidth: shipped(CHAT).userSettings.currentWidth,
    });
  });

  it('drops a stale design size a locked-ratio widget was saved with', () => {
    const locked = Array.from(DEFAULT_WIDGET_BY_ID.values()).find(
      (widget) => widget.lockAspectRatio && widget.designWidth > 0
    )!;

    const widget = decodeWidget(
      {
        id: locked.id,
        type: locked.id,
        enabled: true,
        frame: { x: 0, y: 0, width: 300, height: 999 },
        design: {
          width: locked.designWidth + 20,
          height: locked.designHeight + 120,
        },
        settings: {},
      },
      LEFT
    )!;

    expect(widget.designWidth).toBe(locked.designWidth);
    expect(widget.designHeight).toBe(locked.designHeight);
    expect(widget.userSettings.currentHeight).toBe(
      Math.round(300 * (locked.designHeight / locked.designWidth))
    );
  });

  it('rebuilds the weather design width from its orientation', () => {
    const weather = shipped('weather');

    const widget = decodeWidget(
      {
        id: 'weather',
        type: 'weather',
        enabled: true,
        // A width left behind by a horizontal spell, on a widget saved tall.
        frame: { x: 0, y: 0, width: 340, height: 300 },
        design: { width: 340, height: weather.designHeight },
        settings: { horizontal: false },
      },
      LEFT
    )!;

    expect(widget.designWidth).toBe(weather.designWidth);
    expect(widget.userSettings.currentWidth).toBe(weather.designWidth);
  });

  // A widget whose design width its settings derive (horizontal weather) is
  // saved without one; reading that back as the manifest's width rescaled
  // the widget, so it grew on every restart.
  it('keeps a derived-width widget the same size across restarts', () => {
    const horizontal = decodeWidget(
      {
        id: 'weather',
        type: 'weather',
        enabled: true,
        frame: { x: 2900, y: 1200, width: 500, height: 240 },
        settings: { horizontal: true },
      },
      LEFT
    )!;

    let reloaded = horizontal;

    for (let restart = 0; restart < 3; restart++) {
      reloaded = decodeWidget(encodeWidget(reloaded, LEFT.bounds), LEFT)!;
    }

    expect(horizontal.designWidth).not.toBe(shipped('weather').designWidth);
    expect(reloaded.userSettings).toMatchObject({
      x: 2900,
      y: 1200,
      currentWidth: 500,
    });
    expect(reloaded.designWidth).toBe(horizontal.designWidth);
  });

  it('round-trips through the file unchanged', () => {
    const original = instanceOf(
      CHAT,
      { id: 'stream-chat-2', monitor: 'RIGHT' },
      { x: 2100, y: 300, zIndex: 7, enabled: true, opacity: 0.42 }
    );

    const decoded = decodeWidget(encodeWidget(original, RIGHT.bounds), RIGHT)!;

    expect(decoded).toEqual(original);
  });
});

describe('a layout on disk', () => {
  const layout = (): SavedLayout => ({
    id: 'race',
    name: 'Race',
    createdAt: 1,
    backgroundImages: { LEFT: 'cockpit.png' },
    monitors: [LEFT, RIGHT],
    widgets: [
      instanceOf(CHAT, { monitor: 'LEFT' }, { x: 10, y: 10 }),
      instanceOf(
        CHAT,
        { id: 'stream-chat-2', monitor: 'RIGHT' },
        { x: 2000, y: 10 }
      ),
    ],
  });

  it('nests each widget under the monitor it belongs to', () => {
    const encoded = encodeLayout(layout());

    expect(
      encoded.monitors.map((monitor) =>
        monitor.widgets.map((widget) => widget.id)
      )
    ).toEqual([[CHAT], ['stream-chat-2']]);
  });

  it('keeps a monitor background image on that monitor', () => {
    const encoded = encodeLayout(layout());

    expect(encoded.monitors[0]?.backgroundImage).toBe('cockpit.png');
    expect(encoded.monitors[1]).not.toHaveProperty('backgroundImage');
  });

  // Written straight into a record that was never loaded, a widget can arrive
  // here without an owner; losing it on save would be silent.
  it('files a widget that names no monitor under the first display', () => {
    const unowned = layout();

    unowned.widgets[1]!.monitor = undefined;

    const encoded = encodeLayout(unowned);

    expect(encoded.monitors[0]?.widgets.map((widget) => widget.id)).toEqual([
      CHAT,
      'stream-chat-2',
    ]);
  });

  it('writes the hotkey mark only where it departs from the default', () => {
    const marked = layout();

    marked.widgets[1]!.hotkeys = false;

    const encoded = encodeLayout(marked);

    expect(encoded.monitors[0]?.widgets[0]).not.toHaveProperty('hotkeys');
    expect(encoded.monitors[1]?.widgets[0]?.hotkeys).toBe(false);
    expect(decodeLayout(encoded).widgets[1]?.hotkeys).toBe(false);
  });

  it('round-trips through the file unchanged', () => {
    const original = layout();

    expect(decodeLayout(encodeLayout(original))).toEqual(original);
  });
});

describe('the widget templates', () => {
  it('give every widget the build ships, the manifest where the file has none', () => {
    const templates = decodeTemplates({});

    expect(templates.map((widget) => widget.id)).toEqual(
      Array.from(DEFAULT_WIDGET_BY_ID.keys())
    );
    expect(templates.find((widget) => widget.id === CHAT)).toEqual(
      shipped(CHAT)
    );
  });

  it('round-trip a size and a setting, with no position', () => {
    const edited = decodeTemplates({}).map((widget) =>
      widget.id === CHAT
        ? {
            ...widget,
            userSettings: {
              ...widget.userSettings,
              currentWidth: 512,
              enabled: false,
              opacity: 0.3,
            },
          }
        : widget
    );

    const stored = encodeTemplates(edited);

    expect(stored[CHAT]).toEqual({
      enabled: false,
      size: {
        width: 512,
        height: shipped(CHAT).userSettings.currentHeight,
      },
      settings: { opacity: 0.3 },
    });

    expect(
      decodeTemplates(stored).find((widget) => widget.id === CHAT)
    ).toEqual(edited.find((widget) => widget.id === CHAT));
  });
});
