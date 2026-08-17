import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { WIDGET_BY_ID } from '@store/widget-catalog';
import { useFpsDiagnosticsStore } from '@store/root-store-context';
import type { DiagnosticsResult } from '@store/diagnostics/fps-diagnostics.store';
import type { SampleStats } from '@store/diagnostics/stats';
import styles from './FpsDiagnosticsCard.module.scss';

const EMPTY_CELL = '—';

const formatStat = (stats: SampleStats | null, digits = 1): string => {
  if (!stats) {
    return EMPTY_CELL;
  }

  return stats.median.toFixed(digits);
};

export const DiagnosticsResultsTable = observer(() => {
  const diagnostics = useFpsDiagnosticsStore();
  const { t } = useTranslation('main-app');

  if (diagnostics.results.length === 0) {
    return null;
  }

  const labelFor = (result: DiagnosticsResult): string => {
    if (result.step.kind === 'widget') {
      return (
        WIDGET_BY_ID.get(result.step.widgetId ?? '')?.label ??
        result.step.widgetId ??
        ''
      );
    }

    return t(`settingsPage.fpsDiagnostics.step.${result.step.kind}`);
  };

  // The first step is the empty-overlay baseline every other row is read
  // against: an absolute frame rate says nothing without it.
  const baseline = diagnostics.results[0]?.frameRate?.median ?? null;

  const deltaFor = (result: DiagnosticsResult): string => {
    const median = result.frameRate?.median;

    if (baseline === null || median === undefined) {
      return EMPTY_CELL;
    }

    const delta = median - baseline;

    return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`;
  };

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('settingsPage.fpsDiagnostics.table.config')}</th>
            <th>{t('settingsPage.fpsDiagnostics.table.fps')}</th>
            <th>{t('settingsPage.fpsDiagnostics.table.fpsLow')}</th>
            <th>{t('settingsPage.fpsDiagnostics.table.delta')}</th>
            <th>{t('settingsPage.fpsDiagnostics.table.gpu')}</th>
            <th>{t('settingsPage.fpsDiagnostics.table.cpu')}</th>
          </tr>
        </thead>

        <tbody>
          {diagnostics.results.map((result) => (
            <tr key={result.step.id}>
              <td>{labelFor(result)}</td>
              <td className={styles.numeric}>{formatStat(result.frameRate)}</td>
              <td className={styles.numeric}>
                {result.frameRate
                  ? result.frameRate.low.toFixed(1)
                  : EMPTY_CELL}
              </td>
              <td className={styles.numeric}>{deltaFor(result)}</td>
              <td className={styles.numeric}>
                {formatStat(result.gpuUsage, 0)}
              </td>
              <td className={styles.numeric}>
                {formatStat(result.cpuUsage, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
