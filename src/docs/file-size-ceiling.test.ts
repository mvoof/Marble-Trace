import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A file past its ceiling is a signal to split it, raised when it crosses the
 * line rather than after it has doubled — `LayoutEditor.tsx` and
 * `live-widgets.store.ts` both grew to three times the ceiling unnoticed.
 *
 * Not a lint warning: the commit hook denies warnings, which would forbid
 * touching any long file at all. The files already past the line are listed;
 * a new one fails here, and splitting a listed one removes it from the list.
 */

const COMPONENT_CEILING_LINES = 300;
const STORE_CEILING_LINES = 600;

const KNOWN_LONG_FILES = new Set([
  'features/remote-screens/RemoteScreensSection.tsx',
  'features/voice-crew/voice-crew.store.ts',
  'entities/layout/layouts.store.ts',
  'entities/layout/live-widgets.store.ts',
  'entities/sim/sim.store.ts',
  'pages/crew/CrewCommands.tsx',
  'pages/crew/CrewDownloads.tsx',
  'pages/crew/ReplyBlocks.tsx',
  'pages/layouts/panels/LayoutWidgetPanel.tsx',
  'widgets/coach/coach.store.ts',
  'widgets/g-meter/GMeterCanvas/GMeterTrace/GMeterTrace.tsx',
  'widgets/input-trace/InputTraceSettingsPanel.tsx',
  'widgets/proximity-radar/RadarScope/RadarScope.tsx',
  'widgets/standings/DriverRow/DriverRow.tsx',
  'widgets/standings/StandingsContent/StandingsContent.tsx',
  'widgets/standings/standings.store.ts',
  'widgets/track-map/TrackMapSvg/TrackMapSvg.tsx',
]);

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const ceilingOf = (file: string): number | null => {
  if (/\.(test|stories)\.tsx?$/.test(file)) {
    return null;
  }

  if (file.endsWith('.store.ts')) {
    return STORE_CEILING_LINES;
  }

  if (file.endsWith('.tsx')) {
    return COMPONENT_CEILING_LINES;
  }

  return null;
};

const lineCountOf = (file: string): number =>
  readFileSync(join(SRC_DIR, file), 'utf8').trimEnd().split('\n').length;

const sourceFiles = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => ceilingOf(file) !== null);

const longFiles = sourceFiles.filter(
  (file) => lineCountOf(file) > (ceilingOf(file) ?? Infinity)
);

describe('file size ceiling', () => {
  it('finds the sources', () => {
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('no new file is past its ceiling', () => {
    expect(longFiles.filter((file) => !KNOWN_LONG_FILES.has(file))).toEqual([]);
  });

  it('a split file leaves the list', () => {
    expect(
      [...KNOWN_LONG_FILES].filter((file) => !longFiles.includes(file))
    ).toEqual([]);
  });
});
