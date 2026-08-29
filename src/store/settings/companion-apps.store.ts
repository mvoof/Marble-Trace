import { makeAutoObservable, runInAction } from 'mobx';

import {
  closeCompanionApp,
  closeCompanionApps,
  companionAppIcon,
  companionAppStatuses,
  detectCompanionApps,
  launchCompanionApp,
  pickExecutable,
} from '@platform/services/companions.service';
import type {
  CompanionApp,
  CompanionStatus,
  DetectedApp,
} from '@/types/bindings';
import type { RootStore } from '@store/root-store';

/** How often the list refreshes while the settings section is on screen. */
const STATUS_POLL_MS = 4000;

/**
 * Programs launched at startup are started one after another, not all at once:
 * a rig starts half a dozen of them, and every one of those is a splash screen
 * fighting for the foreground.
 */
const LAUNCH_SPACING_MS = 600;

const MAX_COMPANION_APPS = 32;

const nameFromPath = (path: string) => {
  const file = path.split(/[\\/]/).pop() ?? path;

  return file.replace(/\.(exe|lnk|bat|cmd)$/i, '');
};

const createId = () =>
  `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The other programs a sim rig needs running — detection, the configured list,
 * and starting and stopping them.
 *
 * Lives in the main window only: the overlay never renders this list, and the
 * process snapshot behind it is far too expensive to poll from two places.
 */
export class CompanionAppsStore {
  detected: DetectedApp[] = [];
  detecting = false;

  statuses: Record<string, CompanionStatus> = {};

  /** Icon data URLs by executable path. Null means the file has no icon. */
  icons: Record<string, string | null> = {};

  /** Bumped on every change to the list, so one save reaction covers them all. */
  revision = 0;

  busyId: string | null = null;
  lastError: string | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollers = 0;

  /** The startup launches, while they are still running. */
  private startup: Promise<void> | null = null;

  /** Set once the app is on its way out; no further program may be started. */
  private stopping = false;

  constructor(private root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get apps(): CompanionApp[] {
    return this.root.appSettings.appSettings.companionApps;
  }

  get canAddMore() {
    return this.apps.length < MAX_COMPANION_APPS;
  }

  statusOf(id: string): CompanionStatus | undefined {
    return this.statuses[id];
  }

  /**
   * Starts everything marked to launch with the app. Called once, after the
   * settings have been hydrated — before that the list is still empty.
   */
  launchOnStart(): Promise<void> {
    this.startup = this.runStartupLaunches();

    return this.startup;
  }

  private async runStartupLaunches() {
    for (const app of this.apps) {
      // Startup takes seconds — long enough for the user to close the window
      // in the middle of it. Anything started past that point would outlive
      // the close that was meant to take it down with the app.
      if (this.stopping) break;

      if (!app.launchWithApp) continue;

      await this.launch(app.id);

      await new Promise((resolve) => setTimeout(resolve, LAUNCH_SPACING_MS));
    }

    if (this.stopping) return;

    await this.refreshStatuses();
  }

  /** Reference-counted so two mounted views do not poll twice. */
  startPolling() {
    this.pollers += 1;

    void this.refreshStatuses();

    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      void this.refreshStatuses();
    }, STATUS_POLL_MS);
  }

  stopPolling() {
    this.pollers = Math.max(0, this.pollers - 1);

    if (this.pollers > 0 || !this.pollTimer) return;

    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async refreshStatuses() {
    if (this.apps.length === 0) {
      runInAction(() => {
        this.statuses = {};
      });

      return;
    }

    try {
      const statuses = await companionAppStatuses(this.apps);

      runInAction(() => {
        this.statuses = Object.fromEntries(
          statuses.map((status) => [status.id, status])
        );
      });
    } catch (error) {
      console.error('Failed to read companion app statuses:', error);
    }
  }

  async detect() {
    runInAction(() => {
      this.detecting = true;
    });

    try {
      const detected = await detectCompanionApps();

      runInAction(() => {
        this.detected = detected;
      });

      await Promise.all(detected.map((app) => this.loadIcon(app.path)));
    } catch (error) {
      console.error('Failed to detect companion apps:', error);
    } finally {
      runInAction(() => {
        this.detecting = false;
      });
    }
  }

  /** Detected entries that are not in the list yet. */
  get undetectedOnly(): DetectedApp[] {
    const configured = new Set(this.apps.map((app) => app.path.toLowerCase()));

    return this.detected.filter(
      (app) => !configured.has(app.path.toLowerCase())
    );
  }

  async loadIcon(path: string) {
    if (path in this.icons) return;

    // Claimed before the await so two rows for the same path do not both ask.
    runInAction(() => {
      this.icons[path] = null;
    });

    try {
      const icon = await companionAppIcon(path);

      runInAction(() => {
        this.icons[path] = icon;
      });
    } catch (error) {
      console.error('Failed to read companion app icon:', error);
    }
  }

  async addByPicker() {
    try {
      const path = await pickExecutable();

      if (!path) return;

      // The picker resolves long after the click, so the write back into the
      // settings has to re-enter an action of its own.
      runInAction(() => {
        this.add({ name: nameFromPath(path), path, args: '' });
      });
    } catch (error) {
      console.error('Failed to add a companion app:', error);

      runInAction(() => {
        this.lastError = String(error);
      });
    }
  }

  add(app: {
    name: string;
    path: string;
    args: string;
    processName?: string | null;
  }) {
    if (!this.canAddMore) return;

    if (
      this.apps.some(
        (existing) => existing.path.toLowerCase() === app.path.toLowerCase()
      )
    ) {
      return;
    }

    this.apps.push({
      id: createId(),
      name: app.name,
      path: app.path,
      args: app.args,
      // Kept from detection: a launcher-started program runs under a different
      // executable, and only the catalog knows which one.
      processName: app.processName ?? null,
      launchWithApp: true,
      closeWithApp: false,
    });

    this.revision += 1;

    void this.loadIcon(app.path);
    void this.refreshStatuses();
  }

  remove(id: string) {
    const index = this.apps.findIndex((app) => app.id === id);

    if (index < 0) return;

    this.apps.splice(index, 1);

    delete this.statuses[id];

    this.revision += 1;
  }

  update(id: string, patch: Partial<Omit<CompanionApp, 'id'>>) {
    const app = this.apps.find((entry) => entry.id === id);

    if (!app) return;

    Object.assign(app, patch);

    this.revision += 1;
  }

  async launch(id: string) {
    const app = this.apps.find((entry) => entry.id === id);

    if (!app) return;

    runInAction(() => {
      this.busyId = id;
      this.lastError = null;
    });

    try {
      await launchCompanionApp({ ...app });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    } finally {
      runInAction(() => {
        this.busyId = null;
      });

      await this.refreshStatuses();
    }
  }

  async close(id: string) {
    const app = this.apps.find((entry) => entry.id === id);

    if (!app) return;

    runInAction(() => {
      this.busyId = id;
      this.lastError = null;
    });

    try {
      await closeCompanionApp({ ...app });
    } catch (error) {
      runInAction(() => {
        this.lastError = String(error);
      });
    } finally {
      runInAction(() => {
        this.busyId = null;
      });

      await this.refreshStatuses();
    }
  }

  /**
   * Closes the programs marked to close with the app, on the way out.
   *
   * Awaited by the window close handler rather than left to the backend's
   * own exit hook: by then the process is already going, and a program that
   * takes a moment to exit would outlive the app that was told to close it.
   */
  async closeOnExit(): Promise<string[]> {
    runInAction(() => {
      this.stopping = true;
    });

    // A launch still in flight has to land before anything is counted, or the
    // program it starts is the one nothing closes.
    await this.startup?.catch(() => undefined);

    const marked = this.apps.filter((app) => app.closeWithApp);

    if (marked.length === 0) return [];

    try {
      return await closeCompanionApps(this.apps.map((app) => ({ ...app })));
    } catch (error) {
      console.error('Failed to close companion apps:', error);

      // A failed call closed nothing, so every marked program is still up.
      // Reporting none would say the opposite of what happened.
      return marked.map((app) => app.name);
    }
  }

  dispose() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.pollers = 0;
  }
}
