import { describe, expect, it } from 'vitest';
import { DEFAULT_WIDGETS } from '@entities/widget/widget-catalog';
import { widgetMenuRuns } from './widget-menu';

const CORE_WIDGETS = [
  'input-trace',
  'proximity-radar',
  'radar-bar',
  'relative',
  'standings',
];

const idsOf = (runs: ReturnType<typeof widgetMenuRuns>) =>
  runs.map((run) => run.map((widget) => widget.type));

describe('widgetMenuRuns', () => {
  it('puts the core widgets first, alphabetically, then the rest', () => {
    const [core, rest] = idsOf(widgetMenuRuns(DEFAULT_WIDGETS, 'tier'));

    expect(core).toEqual(CORE_WIDGETS);
    expect(rest).toContain('fuel');
    expect(rest).not.toContain('standings');
    expect(rest).toEqual([...rest].sort());
  });

  it('lists every widget once, A–Z, in one run', () => {
    const runs = idsOf(widgetMenuRuns(DEFAULT_WIDGETS, 'az'));

    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(DEFAULT_WIDGETS.length);
    expect(runs[0].indexOf('input-trace')).toBeLessThan(
      runs[0].indexOf('lap-log')
    );
    expect(runs[0].indexOf('lap-log')).toBeLessThan(
      runs[0].indexOf('standings')
    );
  });

  it('drops an empty run instead of leaving a separator with nothing after it', () => {
    const coreOnly = DEFAULT_WIDGETS.filter((widget) =>
      CORE_WIDGETS.includes(widget.type)
    );

    expect(idsOf(widgetMenuRuns(coreOnly, 'tier'))).toEqual([CORE_WIDGETS]);
  });
});
