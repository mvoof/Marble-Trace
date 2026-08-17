import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Switch } from 'antd';
import { Activity, Save, Square } from 'lucide-react';
import {
  useDiagnosticsExportStore,
  useFpsDiagnosticsStore,
} from '@store/root-store-context';
import { SettingsCard } from '../../SettingsCard';
import { DiagnosticsProgress } from './DiagnosticsProgress';
import { DiagnosticsResultsTable } from './DiagnosticsResultsTable';
import styles from './FpsDiagnosticsCard.module.scss';

const SECONDS_PER_MINUTE = 60;

export const FpsDiagnosticsCard = observer(() => {
  const diagnostics = useFpsDiagnosticsStore();
  const exports = useDiagnosticsExportStore();
  const { message } = App.useApp();
  const { t } = useTranslation('main-app');

  const handleSave = async () => {
    try {
      const path = await exports.saveResultsCsv();

      message.success(t('settingsPage.fpsDiagnostics.saved', { path }));
    } catch (error) {
      message.error(String(error));
    }
  };

  const estimatedMinutes = Math.ceil(
    diagnostics.estimatedSeconds / SECONDS_PER_MINUTE
  );

  return (
    <SettingsCard title={t('settingsPage.fpsDiagnostics.title')}>
      <div className={styles.progress}>
        <div className={styles.hint}>
          {t('settingsPage.fpsDiagnostics.description')}
        </div>

        <div className={styles.phaseLine}>
          <span>{t('settingsPage.fpsDiagnostics.detailed')}</span>

          <Switch
            checked={diagnostics.detailed}
            disabled={diagnostics.isRunning}
            onChange={(value) => diagnostics.setDetailed(value)}
          />
        </div>

        <div className={styles.hint}>
          {t('settingsPage.fpsDiagnostics.detailedDesc')}
        </div>

        <DiagnosticsProgress />

        {diagnostics.error !== null && (
          <div className={styles.hint}>
            {t(`settingsPage.fpsDiagnostics.error.${diagnostics.error}`)}
          </div>
        )}

        <DiagnosticsResultsTable />

        <div className={styles.actions}>
          {diagnostics.isRunning ? (
            <Button
              block
              icon={<Square size={16} />}
              onClick={() => diagnostics.cancel()}
            >
              {t('settingsPage.fpsDiagnostics.cancel')}
            </Button>
          ) : (
            <Button
              block
              type="primary"
              icon={<Activity size={16} />}
              onClick={() => diagnostics.start()}
            >
              {t('settingsPage.fpsDiagnostics.start', {
                minutes: estimatedMinutes,
              })}
            </Button>
          )}

          {diagnostics.results.length > 0 && !diagnostics.isRunning && (
            <Button
              icon={<Save size={16} />}
              loading={exports.saving}
              onClick={() => void handleSave()}
            >
              {t('settingsPage.fpsDiagnostics.saveCsv')}
            </Button>
          )}
        </div>
      </div>
    </SettingsCard>
  );
});
