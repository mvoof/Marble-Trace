/**
 * Session telemetry store — session state + YAML session info.
 *
 * Two data sources:
 * - `frame`: Real-time session state from telemetry stream (60Hz) —
 *   session time, remaining time, flags, state, session index.
 * - `sessionInfo`: Parsed YAML session data from iRacing (on change) —
 *   driver info (RPM limits, fuel capacity), weekend/track info, driver list.
 *
 * @see https://sajax.github.io/irsdkdocs/telemetry/sessiontime/
 * @see https://sajax.github.io/irsdkdocs/yaml/
 */
import { makeAutoObservable } from 'mobx';

import type {
  DriverInfoData,
  SessionFrame,
  SessionInfo,
  WeekendInfo,
} from '../../types/bindings';

class SessionStore {
  /** Real-time session state frame, null when not connected */
  frame: SessionFrame | null = null;

  /**
   * Parsed YAML session info from iRacing.
   * Contains driver car parameters, weekend/track info, and driver list.
   * Updated only when iRacing's session YAML changes (not every frame).
   */
  sessionInfo: SessionInfo | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  updateFrame(frame: SessionFrame) {
    this.frame = frame;
  }

  updateSessionInfo(info: SessionInfo) {
    this.sessionInfo = info;
  }

  /** Convenience getter: driver info (RPM limits, fuel capacity, gear count, etc.) */
  get driverInfo(): DriverInfoData | null {
    return this.sessionInfo?.DriverInfo ?? null;
  }

  /** Convenience getter: weekend/track info (track name, length, weather config, etc.) */
  get weekendInfo(): WeekendInfo | null {
    return this.sessionInfo?.WeekendInfo ?? null;
  }

  reset() {
    this.frame = null;
    this.sessionInfo = null;
  }
}

export const sessionStore = new SessionStore();
