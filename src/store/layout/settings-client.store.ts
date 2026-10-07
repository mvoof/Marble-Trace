import { comparer, makeAutoObservable, runInAction } from 'mobx';

import { emitToMain } from '@platform/services/events.service';
import type { LiveWidgetsView } from '@store/layout/live-widgets.store';
import type { ClientCommand } from '@/types/client-protocol';
import type { WidgetUserSettings } from '@/types/widget-settings';

/**
 * How often a drag or a resize reaches main while it lasts — often enough for
 * a stream screen to follow it, rarely enough not to flood the other windows.
 */
const GEOMETRY_SEND_INTERVAL_MS = 75;

/** Popup edits to one widget within this window go to main as one patch. */
const SETTINGS_MERGE_MS = 50;

/** One field this window changed and main has not yet confirmed. */
interface Override {
  value: unknown;
  /** The command that carried it; null while it waits to be sent. */
  commandNo: number | null;
}

interface PendingGeometry {
  resized: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

type SettingsRecord = Record<string, unknown>;

/**
 * An overlay's side of the client protocol (ADR-0007). A setting changes from
 * this window only as a command to main, which holds the settings.
 *
 * The window draws its own edit at once: the fields a command changes are
 * kept as an override over every snapshot until main has handled that
 * command — applied it, or refused it. Then the snapshot's value stands, which
 * is the edit itself, or main's value when it was refused.
 */
export class SettingsClientStore {
  /** This window's label, set when the overlay connects; main replies to it. */
  clientId: string | null = null;

  /** Counts this window's commands from 1, and starts over with the window. */
  private commandNo = 0;

  private overrides = new Map<string, Map<string, Override>>();

  private geometry = new Map<string, PendingGeometry>();

  private settingsBuffer = new Map<string, SettingsRecord>();

  private settingsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly liveWidgets: LiveWidgetsView,
    /** The live layout this window draws, from its last snapshot. */
    private readonly layoutIdOf: () => string | null
  ) {
    makeAutoObservable<
      SettingsClientStore,
      'liveWidgets' | 'layoutIdOf' | 'overrides' | 'geometry' | 'settingsBuffer'
    >(
      this,
      {
        liveWidgets: false,
        layoutIdOf: false,
        overrides: false,
        geometry: false,
        settingsBuffer: false,
      },
      { autoBind: true }
    );
  }

  connect(clientId: string) {
    this.clientId = clientId;
  }

  /** A drag step. Drawn now, clamped to the monitor as main will clamp it. */
  moveWidget(widgetId: string, x: number, y: number) {
    const position = this.liveWidgets.clampedPosition(widgetId, x, y);

    this.override(widgetId, { x: position.x, y: position.y });
    this.scheduleGeometry(widgetId, false);
  }

  /** A resize step: the size, and the position a top or left edge moves. */
  resizeWidget(
    widgetId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    this.override(widgetId, { currentWidth: width, currentHeight: height });

    const position = this.liveWidgets.clampedPosition(widgetId, x, y);

    this.override(widgetId, { x: position.x, y: position.y });
    this.scheduleGeometry(widgetId, true);
  }

  /** The release of a drag or a resize: the last position goes out now. */
  endGeometry(widgetId: string) {
    const pending = this.geometry.get(widgetId);

    if (!pending) return;

    if (pending.timer !== null) {
      clearTimeout(pending.timer);
    }

    this.geometry.delete(widgetId);
    this.sendGeometry(widgetId, pending.resized, true);
  }

  /** A snap: one step, released at once. */
  snapWidget(widgetId: string, x: number, y: number) {
    this.moveWidget(widgetId, x, y);
    this.endGeometry(widgetId);
  }

  setEnabled(widgetId: string, enabled: boolean) {
    this.override(widgetId, { enabled });

    const commandNo = this.send({ kind: 'setEnabled', widgetId, enabled });

    this.stamp(widgetId, ['enabled'], commandNo);
  }

  /** The F9 picker: main chooses the instance and where it stands. */
  enableTypeOnMonitor(type: string, monitor: string) {
    this.send({ kind: 'enableTypeOnMonitor', type, monitor });
  }

  /**
   * A popup edit. Panels hand over their whole settings with one value
   * changed; only the fields that differ from what is drawn go to main, so a
   * patch never carries back a value main has changed meanwhile.
   */
  patchSettings(widgetId: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.liveWidgets.getWidget(widgetId);

    if (!widget) return;

    const current = widget.userSettings as unknown as SettingsRecord;
    const changed: SettingsRecord = {};

    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined && !comparer.structural(current[key], value)) {
        changed[key] = value;
      }
    }

    if (Object.keys(changed).length === 0) return;

    this.override(widgetId, changed);
    this.settingsBuffer.set(widgetId, {
      ...this.settingsBuffer.get(widgetId),
      ...changed,
    });

    this.settingsTimer ??= setTimeout(
      () => this.flushSettings(),
      SETTINGS_MERGE_MS
    );
  }

  /**
   * After a snapshot is installed: forgets what main has handled, and draws
   * what it has not over the snapshot again.
   */
  acknowledge(lastHandledCommandNo: number) {
    for (const [widgetId, fields] of this.overrides) {
      for (const [field, entry] of fields) {
        if (
          entry.commandNo !== null &&
          entry.commandNo <= lastHandledCommandNo
        ) {
          fields.delete(field);
        }
      }

      if (fields.size === 0) {
        this.overrides.delete(widgetId);

        continue;
      }

      this.draw(widgetId, fields);
    }
  }

  private flushSettings() {
    this.settingsTimer = null;

    for (const [widgetId, partial] of this.settingsBuffer) {
      const commandNo = this.send({
        kind: 'patchSettings',
        widgetId,
        partial: partial as Partial<WidgetUserSettings>,
      });

      this.stamp(widgetId, Object.keys(partial), commandNo);
    }

    this.settingsBuffer.clear();
  }

  private scheduleGeometry(widgetId: string, resized: boolean) {
    const pending = this.geometry.get(widgetId) ?? {
      resized: false,
      timer: null,
    };

    pending.resized ||= resized;

    if (pending.timer === null) {
      pending.timer = setTimeout(() => {
        pending.timer = null;
        this.sendGeometry(widgetId, pending.resized, false);
      }, GEOMETRY_SEND_INTERVAL_MS);
    }

    this.geometry.set(widgetId, pending);
  }

  private sendGeometry(widgetId: string, resized: boolean, final: boolean) {
    const widget = this.liveWidgets.getWidget(widgetId);

    if (!widget) return;

    const { x, y, currentWidth, currentHeight } = widget.userSettings;
    const commandNo = this.send({
      kind: 'setGeometry',
      widgetId,
      x,
      y,
      ...(resized ? { width: currentWidth, height: currentHeight } : {}),
      final,
    });

    this.stamp(
      widgetId,
      resized ? ['x', 'y', 'currentWidth', 'currentHeight'] : ['x', 'y'],
      commandNo
    );
  }

  /** Records fields as this window's and draws them. */
  private override(widgetId: string, fields: SettingsRecord) {
    const entries = this.overrides.get(widgetId) ?? new Map<string, Override>();

    for (const [field, value] of Object.entries(fields)) {
      entries.set(field, { value, commandNo: null });
    }

    this.overrides.set(widgetId, entries);
    this.draw(widgetId, entries);
  }

  /** Marks fields as carried by a command, unless edited again since. */
  private stamp(widgetId: string, fields: string[], commandNo: number | null) {
    const entries = this.overrides.get(widgetId);

    if (!entries || commandNo === null) return;

    for (const field of fields) {
      const entry = entries.get(field);

      if (entry) {
        entry.commandNo = commandNo;
      }
    }
  }

  private draw(widgetId: string, fields: Map<string, Override>) {
    const widget = this.liveWidgets.getWidget(widgetId);

    if (!widget) return;

    runInAction(() => {
      const settings = widget.userSettings as unknown as SettingsRecord;

      for (const [field, entry] of fields) {
        settings[field] = entry.value;
      }
    });
  }

  /** Sends a command and returns its number, or null when it could not go. */
  private send(command: ClientCommand): number | null {
    const clientId = this.clientId;
    const layoutId = this.layoutIdOf();

    // Before the first snapshot there is nothing on screen to act on.
    if (!clientId || !layoutId) return null;

    this.commandNo++;

    const commandNo = this.commandNo;

    void emitToMain({
      kind: 'command',
      clientId,
      commandNo,
      layoutId,
      command,
    }).catch((error: unknown) =>
      console.error('[settings-client] command not sent:', error)
    );

    return commandNo;
  }
}
