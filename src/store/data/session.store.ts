import { makeAutoObservable } from 'mobx';

import type {
  SessionFrame,
  SessionSnapshot,
  SessionType,
} from '@/types/bindings';

export class SessionStore {
  session: SessionFrame | null = null;
  sessionInfo: SessionSnapshot | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get currentSessionType(): SessionType | null {
    if (!this.sessionInfo) return null;
    const num = this.sessionInfo.currentSessionNum;
    if (num === null || num === undefined || num < 0) return null;
    return this.sessionInfo.sessions[num]?.sessionType ?? null;
  }

  updateSession(frame: SessionFrame) {
    this.session = frame;
  }

  updateSessionInfo(info: SessionSnapshot) {
    this.sessionInfo = info;
  }

  reset() {
    this.session = null;
    this.sessionInfo = null;
  }
}
