import type { DiagnosticsResult } from './fps-diagnostics.store';
import type { SampleStats } from './stats';

const CSV_HEADER =
  'config,samples,fps_median,fps_p5,fps_p95,gpu_median,cpu_median';

const cell = (stats: SampleStats | null, key: keyof SampleStats): string => {
  if (!stats) {
    return '';
  }

  return stats[key].toFixed(1);
};

/**
 * CSV rather than a rendered table: the numbers are only useful next to another
 * run's numbers, and comparing runs happens in a spreadsheet or a bug report,
 * not in this window.
 */
export const resultsToCsv = (results: DiagnosticsResult[]): string => {
  const rows = results.map((result) => {
    const label =
      result.step.kind === 'widget' ? result.step.widgetId : result.step.kind;

    return [
      label,
      result.frameRate?.samples ?? 0,
      cell(result.frameRate, 'median'),
      cell(result.frameRate, 'low'),
      cell(result.frameRate, 'high'),
      cell(result.gpuUsage, 'median'),
      cell(result.cpuUsage, 'median'),
    ].join(',');
  });

  return [CSV_HEADER, ...rows].join('\n');
};
