import { makeAutoObservable, runInAction } from 'mobx';
import { invoke } from '@tauri-apps/api/core';

import type { TwitchDeviceCode, TwitchTokenResult } from '@/types/bindings';
import type { RootStore } from '@store/root-store';

const MS_PER_SECOND = 1000;

/**
 * Twitch device code sign-in.
 *
 * Chosen over the authorization code flow because it is the only user-token
 * flow a desktop app can complete without shipping a client secret: the app
 * shows a short code, the user types it on twitch.tv/activate, and a refresh
 * token comes back. Reading chat works without any of this — signing in only
 * unlocks the viewer count and uptime.
 *
 * No token ever reaches this store. They are written to the OS credential store
 * by the backend, which also refreshes them when Helix rejects one; all that
 * crosses the bridge is the login name.
 */
export class TwitchAuthStore {
  deviceCode: TwitchDeviceCode | null = null;
  isPolling = false;
  error: string | null = null;
  /** Whether the build carries a client id, so no registration is needed. */
  hasBakedClientId = false;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable<TwitchAuthStore, 'pollTimer' | 'expiryTimer' | 'root'>(
      this,
      { pollTimer: false, expiryTimer: false, root: false },
      { autoBind: true }
    );
  }

  async init() {
    try {
      const available = await invoke<boolean>('twitch_has_client_id');

      runInAction(() => {
        this.hasBakedClientId = available;
      });
    } catch (error) {
      // Older backend without this command, or a failed invoke. Fall back to
      // "no baked id" so the settings page offers the manual field instead of
      // a sign-in button that could never work.
      console.warn('twitch client id probe failed', error);

      runInAction(() => {
        this.hasBakedClientId = false;
      });
    }
  }

  private get clientIdOverride(): string | null {
    return (
      this.root.appSettings.appSettings.streamChatTwitchClientId.trim() || null
    );
  }

  get isSignedIn(): boolean {
    return this.root.appSettings.appSettings.streamChatTwitchLogin !== null;
  }

  /** Sign-in is possible with either a baked id or one the user supplied. */
  get canSignIn(): boolean {
    return this.hasBakedClientId || this.clientIdOverride !== null;
  }

  get login(): string | null {
    return this.root.appSettings.appSettings.streamChatTwitchLogin;
  }

  /**
   * Asks the backend who the stored credentials belong to. It refreshes an
   * expired token on the way, so an app left closed overnight signs itself back
   * in rather than nagging the user.
   *
   * Called from initMainSync rather than init(): this store is constructed
   * before settings are read from disk, and hydration would overwrite the
   * result with the stale login it just loaded.
   */
  async syncLogin() {
    try {
      const login = await invoke<string | null>('twitch_current_login', {
        clientId: this.clientIdOverride,
      });

      const stored = this.root.appSettings.appSettings.streamChatTwitchLogin;

      if (login === stored) {
        return;
      }

      runInAction(() => {
        this.root.appSettings.setStreamChatTwitchLogin(login);

        if (login === null && stored !== null) {
          this.error = 'sessionExpired';
        }
      });
    } catch (error) {
      console.warn('twitch login probe failed', error);
    }
  }

  async start() {
    if (!this.canSignIn) {
      runInAction(() => {
        this.error = 'clientIdRequired';
      });

      return;
    }

    this.cancel();

    // Empty means "use the baked-in id" — the backend resolves the fallback.
    const clientId = this.clientIdOverride;

    try {
      const code = await invoke<TwitchDeviceCode>(
        'twitch_request_device_code',
        { clientId }
      );

      runInAction(() => {
        this.deviceCode = code;
        this.isPolling = true;
        this.error = null;
      });

      this.scheduleExpiry(code.expiresIn);
      this.schedulePoll(clientId, code);
    } catch (error) {
      runInAction(() => {
        this.error = String(error);
      });
    }
  }

  cancel() {
    this.clearTimers();
    this.deviceCode = null;
    this.isPolling = false;
  }

  async signOut() {
    this.cancel();

    try {
      await invoke('twitch_sign_out');
    } catch (error) {
      console.warn('twitch sign out failed', error);
    }

    runInAction(() => {
      this.root.appSettings.setStreamChatTwitchLogin(null);
      this.error = null;
    });
  }

  private clearTimers() {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private scheduleExpiry(seconds: number) {
    this.expiryTimer = setTimeout(() => {
      runInAction(() => {
        this.cancel();
        this.error = 'codeExpired';
      });
    }, seconds * MS_PER_SECOND);
  }

  /**
   * Polls at the interval Twitch dictates. `authorized: false` with no error is
   * the normal state while the user is still typing the code in.
   */
  private schedulePoll(clientId: string | null, code: TwitchDeviceCode) {
    this.pollTimer = setTimeout(() => {
      void this.poll(clientId, code);
    }, code.interval * MS_PER_SECOND);
  }

  private async poll(clientId: string | null, code: TwitchDeviceCode) {
    if (!this.isPolling) {
      return;
    }

    try {
      const result = await invoke<TwitchTokenResult>(
        'twitch_poll_device_token',
        { clientId, deviceCode: code.deviceCode }
      );

      if (result.error) {
        runInAction(() => {
          this.cancel();
          this.error = result.error;
        });

        return;
      }

      if (result.authorized) {
        runInAction(() => {
          this.root.appSettings.setStreamChatTwitchLogin(result.login);
          this.cancel();
          this.error = null;
        });

        return;
      }

      this.schedulePoll(clientId, code);
    } catch (error) {
      runInAction(() => {
        this.cancel();
        this.error = String(error);
      });
    }
  }

  dispose() {
    this.clearTimers();
  }
}
