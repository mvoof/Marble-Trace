import { describe, expect, it, vi, beforeEach } from 'vitest';

import { RemoteRoot } from '@store/remote-root';
import { OverlayRoot } from '@store/overlay-root';
import { RemoteScreenStore } from '@store/remote/remote-screen.store';
import type { RendererCore } from '@store/renderer-core';
import type { WidgetInstanceContext } from '@store/widgets/widget-instances';
import type { RemoteControlKind } from '@/types/bindings';
import type { ControlMessage } from '@/types/client-protocol';
import type { RemoteMessage } from '@/types/remote';

// Each transport's inbound handler, captured as it subscribes: the overlay's
// Tauri listener for the control event, and the remote page's socket.
const inbound = vi.hoisted(() => ({
  overlay: null as null | ((message: ControlMessage) => void),
  remote: null as null | ((message: RemoteMessage) => void),
}));

vi.mock('@platform/services/events.service', () => ({
  listenTo: vi.fn(
    async (
      event: string,
      handler: (event: { payload: ControlMessage }) => void
    ) => {
      if (event === 'client://control') {
        inbound.overlay = (message) => handler({ payload: message });
      }

      return () => {};
    }
  ),
}));

vi.mock('@platform/services/hotkeys.service', () => ({
  getOverlayModes: vi.fn(async () => ({
    dragMode: false,
    interactMode: false,
  })),
}));

vi.mock('@platform/services/remote-socket.service', () => ({
  openRemoteSocket: vi.fn(
    (options: { onMessage: (message: RemoteMessage) => void }) => {
      inbound.remote = options.onMessage;

      return () => {};
    }
  ),
}));

vi.mock('@platform/services/settings.service', () => ({
  setFuelAvgWindowSilent: vi.fn(),
  setFuelCountYellowLapsSilent: vi.fn(),
  setPitWarningLapsSilent: vi.fn(),
  setActiveEventsSilent: vi.fn(),
  setCarLengthSilent: vi.fn(),
}));

const { setupOverlayListeners } = await import('./listeners');
const { initRemoteSync } = await import('./remote-sync');

/** A mounted standings table and chat window under the hotkeys. */
const mountHotkeyTargets = (core: RendererCore) => {
  const standings = {
    stepClass: vi.fn(),
    scrollByRows: vi.fn(),
    dispose: vi.fn(),
  };
  const chat = { scrollByRows: vi.fn(), dispose: vi.fn() };

  core.widgetInstances.open(
    { core, instanceId: 'standings', type: 'standings' },
    () => standings
  );
  core.widgetInstances.open(
    {
      core,
      instanceId: 'stream-chat',
      type: 'stream-chat',
    } as WidgetInstanceContext,
    () => chat
  );

  return { standings, chat };
};

type Targets = ReturnType<typeof mountHotkeyTargets>;

/**
 * One case per kind — a `Record` over the generated union, so a kind added in
 * Rust without a case here does not compile, exactly as the handler itself.
 */
const CASES: Record<
  RemoteControlKind,
  {
    data: unknown;
    prepare?: (core: RendererCore) => void;
    expect: (core: RendererCore, targets: Targets) => void;
  }
> = {
  'standings-class-step': {
    data: 1,
    expect: (_core, { standings }) =>
      expect(standings.stepClass).toHaveBeenCalledWith(1),
  },
  'standings-scroll': {
    data: -3,
    expect: (_core, { standings }) =>
      expect(standings.scrollByRows).toHaveBeenCalledWith(-3),
  },
  'stream-chat-scroll': {
    data: 2,
    expect: (_core, { chat }) =>
      expect(chat.scrollByRows).toHaveBeenCalledWith(2),
  },
  'track-rotation': {
    data: { trackId: 'spa', rotation: 90 },
    expect: (core) => expect(core.trackMapWidget.trackRotation).toBe(90),
  },
  'pit-service-toggle': {
    data: null,
    expect: (core) => expect(core.pitServiceWidget.panel.manualShow).toBe(true),
  },
  'stream-chat-cleared': {
    data: null,
    prepare: (core) =>
      core.chat.appendMessage({
        id: 'one',
      } as Parameters<RendererCore['chat']['appendMessage']>[0]),
    expect: (core) => expect(core.chat.messages).toEqual([]),
  },
  'layout-activated': {
    data: 'Race',
    expect: (core) =>
      expect(core.liveWidgets.layoutActivatedToast).toBe('Race'),
  },
  'track-map-cleared': {
    data: null,
    prepare: (core) => core.trackMapWidget.applyTrackRotation('spa', 90),
    expect: (core) => expect(core.trackMapWidget.trackRotation).toBe(0),
  },
};

const KINDS = Object.keys(CASES) as RemoteControlKind[];

beforeEach(() => {
  vi.useFakeTimers();
  inbound.overlay = null;
  inbound.remote = null;
});

describe('a signal reaching an overlay', () => {
  it.each(KINDS)('%s', async (kind) => {
    const root = new OverlayRoot({ skipInit: true });
    const targets = mountHotkeyTargets(root);

    await setupOverlayListeners(root);
    CASES[kind].prepare?.(root);
    inbound.overlay!({ type: kind, data: CASES[kind].data });

    CASES[kind].expect(root, targets);
  });
});

describe('the same signal reaching a remote screen', () => {
  it.each(KINDS)('%s', (kind) => {
    const root = new RemoteRoot();
    const targets = mountHotkeyTargets(root);

    initRemoteSync(root, new RemoteScreenStore('stream'), '');
    CASES[kind].prepare?.(root);
    inbound.remote!({ type: kind, data: CASES[kind].data });

    CASES[kind].expect(root, targets);
  });
});
