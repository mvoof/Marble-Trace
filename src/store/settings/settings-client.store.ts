import { makeAutoObservable } from 'mobx';

import { emitToMain } from '@platform/services/events.service';
import type { ClientCommand } from '@/types/client-protocol';

/**
 * An overlay's side of the client protocol (ADR-0007): the way a setting
 * changes from this window is a command to main, which holds the settings.
 * Main answers with the next snapshot; nothing is applied here in advance.
 */
export class SettingsClientStore {
  /** This window's label, set when the overlay connects; main replies to it. */
  clientId: string | null = null;

  /** Counts this window's commands from 1, and starts over with the window. */
  private commandNo = 0;

  constructor(
    /** The live layout the overlay draws, from its last snapshot. */
    private readonly layoutIdOf: () => string | null
  ) {
    makeAutoObservable<SettingsClientStore, 'layoutIdOf'>(
      this,
      { layoutIdOf: false },
      { autoBind: true }
    );
  }

  connect(clientId: string) {
    this.clientId = clientId;
  }

  /** The F9 picker: main chooses the instance and where it stands. */
  enableTypeOnMonitor(type: string, monitor: string) {
    this.send({ kind: 'enableTypeOnMonitor', type, monitor });
  }

  private send(command: ClientCommand) {
    const clientId = this.clientId;
    const layoutId = this.layoutIdOf();

    // Before the first snapshot there is nothing on screen to act on.
    if (!clientId || !layoutId) return;

    this.commandNo++;

    void emitToMain({
      kind: 'command',
      clientId,
      commandNo: this.commandNo,
      layoutId,
      command,
    }).catch((error: unknown) =>
      console.error('[settings-client] command not sent:', error)
    );
  }
}
