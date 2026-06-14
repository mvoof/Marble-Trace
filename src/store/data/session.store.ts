import { makeAutoObservable } from 'mobx';

import type { SessionFrame, SessionSnapshot } from '@/types/bindings';

export class SessionStore {
  session: SessionFrame | null = null;
  sessionInfo: SessionSnapshot | null = null;

  constructor() {
    makeAutoObservable(this);
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
