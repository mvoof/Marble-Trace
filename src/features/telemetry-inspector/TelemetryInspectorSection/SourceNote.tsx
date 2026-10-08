import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';

import { useTelemetryInspectorStore } from '@features/telemetry-inspector/telemetry-inspector-context';
import type { InspectorSource } from '@features/telemetry-inspector/inspector';
import styles from './TelemetryInspectorSection.module.scss';

const NOTE_KEYS: Record<InspectorSource, string> = {
  rawTelemetry: 'settingsPage.telemetryInspector.noteRawTelemetry',
  rawSession: 'settingsPage.telemetryInspector.noteRawSession',
  telemetry: 'settingsPage.telemetryInspector.noteTelemetry',
  session: 'settingsPage.telemetryInspector.noteSession',
};

/**
 * Says what the stream on screen is. A processed view is marked as such and
 * names where the processing happens, so nobody reads the app's output as what
 * the sim sent.
 */
export const SourceNote = observer(() => {
  const inspector = useTelemetryInspectorStore();
  const { t } = useTranslation('main-app');

  const note = t(NOTE_KEYS[inspector.source]);

  if (inspector.showsAbsent) {
    return (
      <Alert
        type="warning"
        showIcon
        className={styles.alert}
        message={t('settingsPage.telemetryInspector.noteProcessedTitle')}
        description={note}
      />
    );
  }

  return <Alert type="info" showIcon className={styles.alert} message={note} />;
});
