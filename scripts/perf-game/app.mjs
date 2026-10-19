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
/** Seconds `stop` keeps killing the app before it gives up. */
const STOP_ATTEMPTS = 15;

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

/** Widest row `pack` lays out before starting the next, in layout pixels. */
const PACK_ROW_WIDTH = 1900;
const PACK_GAP = 8;

/**
 * Moves the widgets into rows from the monitor's top-left corner, tallest
 * first, so the overlay window can shrink to them without cutting any off.
 */
const packFromTopLeft = (widgets) => {
  const byHeight = [...widgets].sort(
    (first, second) => second.frame.height - first.frame.height
  );
  let rowX = 0;
  let rowY = 0;
  let rowHeight = 0;

  for (const widget of byHeight) {
    if (rowX > 0 && rowX + widget.frame.width > PACK_ROW_WIDTH) {
      rowX = 0;
      rowY += rowHeight + PACK_GAP;
      rowHeight = 0;
    }

    widget.frame.x = rowX;
    widget.frame.y = rowY;
    rowX += widget.frame.width + PACK_GAP;
    rowHeight = Math.max(rowHeight, widget.frame.height);
  }
};

/**
 * What a run changes in the settings. Only the given fields are touched:
 * `layout` becomes the active layout with layout auto-switching off (a replay
 * would switch it back to its session's layout), `widgets` keeps only those
 * instance ids on among the ones already on, `pack` gathers them in the
 * monitor's top-left corner, `rateHz` sets the overlay update rate.
 */
const applyRunSettings = (settings, { layout, widgets, pack, rateHz }) => {
  const enabled = [];
  const extents = [];

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
    const shown = [];

    for (const widget of monitor.widgets) {
      if (widget.enabled === false) {
        continue;
      }

      if (keep && !keep.has(widget.id)) {
        widget.enabled = false;
      } else {
        enabled.push(`${monitor.name}/${widget.id}`);
        shown.push(widget);
      }
    }

    if (pack) {
      packFromTopLeft(shown);
    }

    if (shown.length > 0) {
      extents.push({
        monitor: monitor.name,
        right: Math.max(
          ...shown.map((widget) => widget.frame.x + widget.frame.width)
        ),
        bottom: Math.max(
          ...shown.map((widget) => widget.frame.y + widget.frame.height)
        ),
      });
    }
  }

  if (rateHz) {
    settings.app.overlayUpdateHz = rateHz;
  }

  return { layout: active?.name, enabled, extents };
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
 * environment — a tape, a debugging port. `afterStart` gets the process id
 * once the windows are up, before the settle wait. Returns a function that
 * stops it.
 */
export const launchApp = async (env = {}, afterStart = () => {}) => {
  const child = spawn(APP_EXE, [], {
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: false,
  });

  await sleep(STARTUP_SECONDS * MS_PER_SECOND);
  minimizeSettingsWindow(child.pid);
  afterStart(child.pid);
  await sleep(SETTLE_SECONDS * MS_PER_SECOND);

  const stop = async () => {
    // The app's own exit path saves the settings: the restore that follows
    // must not start while any instance is still alive to overwrite it.
    for (let attempt = 0; attempt < STOP_ATTEMPTS; attempt += 1) {
      const running = processIdsOf(APP_PROCESS_NAME);

      if (running.length === 0) {
        await sleep(MS_PER_SECOND);

        return;
      }

      for (const processId of running) {
        try {
          process.kill(processId);
        } catch {
          // Already gone.
        }
      }

      await sleep(MS_PER_SECOND);
    }

    throw new Error(
      'Marble Trace is still running after the run — close it before the settings are restored'
    );
  };

  return stop;
};
