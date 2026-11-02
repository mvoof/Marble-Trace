import { action, makeAutoObservable, runInAction } from 'mobx';
import { listenTo, type UnlistenFn } from '@shared/api/events.service';

import type { CrewRadioEvent } from '@shared/contracts/generated/bindings';
import { CREW_RADIO_EVENT } from '@shared/api/sim-events';

/** How long the radio stays up after the last thing said on it. */
export const CREW_RADIO_HOLD_MS = 2500;

/** The most lines kept — the widget shows a few, this only bounds memory. */
const LINE_LIMIT = 20;

export type CrewRadioSpeaker = 'driver' | 'engineer';

/** A command's outcome: carried out, refused, or not a command at all. */
export type CrewRadioResult = 'ok' | 'failed' | null;

export interface CrewRadioLine {
  id: number;
  speaker: CrewRadioSpeaker;
  text: string;
  /** Beside the driver's sentence: what became of the commands in it. */
  result: CrewRadioResult;
  /** The engineer's reply is being spoken right now. */
  onAir: boolean;
}

/**
 * The voice crew's radio as the overlay sees it: whether push-to-talk is
 * down, what the driver said and what the engineer answered. The backend
 * speaks, hears and carries out; this only follows its `crew://radio` events.
 */
export class CrewRadioStore {
  listening = false;
  lines: CrewRadioLine[] = [];
  /** Something was just said, and the radio stays up for a moment after it. */
  holding = false;

  private nextId = 1;

  private holdTimer: ReturnType<typeof setTimeout> | null = null;

  private unlisteners: UnlistenFn[] = [];

  constructor() {
    makeAutoObservable<CrewRadioStore, 'nextId' | 'holdTimer' | 'unlisteners'>(
      this,
      { nextId: false, holdTimer: false, unlisteners: false },
      { autoBind: true }
    );
  }

  async init() {
    const unlisten = await listenTo<CrewRadioEvent>(
      CREW_RADIO_EVENT,
      (event) => {
        runInAction(() => this.apply(event.payload));
      }
    );

    this.unlisteners.push(unlisten);
  }

  /** The radio has something to show: a press, a voice, or its afterglow. */
  get isActive(): boolean {
    return this.listening || this.holding || this.onAirLine !== null;
  }

  get onAirLine(): CrewRadioLine | null {
    return this.lines.find((line) => line.onAir) ?? null;
  }

  apply(event: CrewRadioEvent) {
    switch (event.kind) {
      case 'listening': {
        this.listening = event.on;

        if (event.on) {
          this.clearHold();
        } else {
          this.hold();
        }

        break;
      }

      case 'heard': {
        // A sentence that is not all commands the crew knows is a command
        // refused before anything was tried.
        this.push('driver', event.text, event.understood ? null : 'failed');
        this.hold();

        break;
      }

      case 'command': {
        this.markCommand(event.ok);

        break;
      }

      case 'speaking': {
        this.endOnAir();
        this.push('engineer', event.text, null, true);
        this.clearHold();

        break;
      }

      case 'finished': {
        this.endOnAir();
        this.hold();

        break;
      }

      case 'failed': {
        this.endOnAir();
        this.push('engineer', event.message, 'failed');
        this.hold();

        break;
      }

      // A test press in the Crew tab is not on the air.
      case 'tested': {
        break;
      }
    }
  }

  /**
   * Several commands in one sentence answer one by one; the mark beside it
   * stays ✗ once any of them was refused.
   */
  private markCommand(ok: boolean) {
    const sentence = this.lines.findLast((line) => line.speaker === 'driver');

    if (!sentence || sentence.result === 'failed') {
      return;
    }

    sentence.result = ok ? 'ok' : 'failed';
  }

  private push(
    speaker: CrewRadioSpeaker,
    text: string,
    result: CrewRadioResult,
    onAir = false
  ) {
    this.lines.push({ id: this.nextId, speaker, text, result, onAir });
    this.nextId += 1;

    if (this.lines.length > LINE_LIMIT) {
      this.lines.splice(0, this.lines.length - LINE_LIMIT);
    }
  }

  private endOnAir() {
    for (const line of this.lines) {
      line.onAir = false;
    }
  }

  private hold() {
    this.clearHold();
    this.holding = true;
    this.holdTimer = setTimeout(
      action(() => {
        this.holding = false;
        this.holdTimer = null;
      }),
      CREW_RADIO_HOLD_MS
    );
  }

  private clearHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    this.holding = false;
  }

  reset() {
    this.clearHold();
    this.listening = false;
    this.lines = [];
  }

  dispose() {
    this.clearHold();
    this.unlisteners.forEach((unlisten) => unlisten());
    this.unlisteners = [];
  }
}
