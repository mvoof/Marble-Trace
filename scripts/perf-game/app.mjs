// Starting and stopping the measured app, and the settings a run puts it on.
// A run edits the user's own settings file — the layout, the widgets on it,
// the overlay rate — so it always backs the file up first and always puts it
// back, whatever happened in between.

import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

import { minimizeSettingsWindow, processIdsOf } from './powershell.mjs';

const ROOT = process.cwd();

export const APP_EXE = path.join(
  ROOT,
  'src-tauri',
  'target',
  'release',
  'marble-trace.exe'
);
const APP_PROCESS_NAME = 'marble-trace';
const SETTINGS_FILE = path.join(
  process.env.APPDATA ?? '',
  'com.voof.marble-trace',
  'settings.json'
);

const MS_PER_SECOND = 1000;
/** From launch to an overlay that has painted and a settings window to hide. */
const STARTUP_SECONDS = 12;
/** After hiding the settings window, before anything is measured. */
const SETTLE_SECONDS = 8;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const assertAppNotRunning = () => {
  if (processIdsOf(APP_PROCESS_NAME).length > 0) {
    throw new Error(
      'Marble Trace is running — close it first: a run restarts the app and rewrites its settings'
    );
  }

  if (!existsSync(APP_EXE)) {
    throw new Error(`${APP_EXE} not found — build it with npm run perf:build`);
  }
};

/**
 * What a run changes in the settings. Only the given fields are touched:
 * `layout` becomes the active layout with layout auto-switching off (a replay
 * would switch it back to its session's layout), `widgets` keeps only those
 * instance ids on among the ones already on, `rateHz` sets the overlay update
 * rate.
 */
const applyRunSettings = (settings, { layout, widgets, rateHz }) => {
  const enabled = [];

  if (layout) {
    const target = settings.layouts.find(
      (candidate) => candidate.name === layout
    );

    if (!target) {
      throw new Error(
        `no layout named "${layout}" — have: ${settings.layouts.map((candidate) => candidate.name).join(', ')}`
      );
    }

    settings.activeLayoutId = target.id;
    settings.app.autoSwitchLayouts = false;
  }

  const active = settings.layouts.find(
    (candidate) => candidate.id === settings.activeLayoutId
  );
  const keep = widgets ? new Set(widgets) : null;

  for (const monitor of active?.monitors ?? []) {
    for (const widget of monitor.widgets) {
      if (widget.enabled === false) {
        continue;
      }

      if (keep && !keep.has(widget.id)) {
        widget.enabled = false;
      } else {
        enabled.push(`${monitor.name}/${widget.id}`);
      }
    }
  }

  if (rateHz) {
    settings.app.overlayUpdateHz = rateHz;
  }

  return { layout: active?.name, enabled };
};

/**
 * Runs `body` with the settings prepared for the run, then restores the
 * user's file byte for byte.
 */
export const withRunSettings = async (outDir, change, body) => {
  const backup = path.join(outDir, 'settings.backup.json');
  const original = readFileSync(SETTINGS_FILE);
  copyFileSync(SETTINGS_FILE, backup);

  try {
    const file = JSON.parse(original.toString('utf8'));
    const applied = applyRunSettings(file.settings, change);
    writeFileSync(SETTINGS_FILE, JSON.stringify(file, null, 2));

    return await body(applied);
  } finally {
    writeFileSync(SETTINGS_FILE, original);
  }
};

/**
 * Starts the app, waits for it, hides its settings window. `env` adds to the
 * environment — a tape, a debugging port. Returns a function that stops it.
 */
export const launchApp = async (env = {}) => {
  const child = spawn(APP_EXE, [], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: false,
  });

  await sleep(STARTUP_SECONDS * MS_PER_SECOND);
  minimizeSettingsWindow(child.pid);
  await sleep(SETTLE_SECONDS * MS_PER_SECOND);

  const stop = async () => {
    for (const processId of processIdsOf(APP_PROCESS_NAME)) {
      try {
        process.kill(processId);
      } catch {
        // Already gone.
      }
    }

    // The app's own exit path saves the settings; give it no chance to race
    // the restore that follows.
    await sleep(MS_PER_SECOND);
  };

  return stop;
};
