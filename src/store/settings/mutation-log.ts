import { makeAutoObservable } from 'mobx';

/**
 * Whether the settings changed since anyone last looked: one counter, moved by
 * every settings write. In main it is what the save reaction and the client
 * publishing watch; in a client (an overlay, a remote screen) and in a preview
 * core it moves when a snapshot or a mirror is installed, which is the cue for
 * anything mirroring those settings further.
 *
 * Main is the only window that writes the settings (ADR-0007), so there is no
 * second counter for edits arriving from elsewhere and nothing to keep from
 * echoing back — the reason the log once also collected the widgets touched.
 */
export class SettingsMutationLog {
  changeToken = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** A settings write happened. */
  record() {
    this.changeToken++;
  }
}
