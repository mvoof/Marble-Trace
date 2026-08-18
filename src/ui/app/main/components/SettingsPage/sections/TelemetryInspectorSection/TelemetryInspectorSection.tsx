import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Empty, Input, Segmented, Switch, Tag } from 'antd';
import { Search } from 'lucide-react';

import { useTelemetryInspectorStore } from '@store/root-store-context';
import type { InspectorSource } from '@/types/inspector';
import { SettingsCard } from '../../SettingsCard';
import { InspectorRowLine } from './InspectorRowLine';
import styles from './TelemetryInspectorSection.module.scss';

/**
 * Browser over the two raw streams the app receives: the per-tick telemetry
 * frame, and the parsed session YAML.
 *
 * It shows the adapted frame whole — including the fields no widget is sent,
 * before tiering, demand gating and quantization — which makes it the one place
 * that can answer "does this session report that at all?".
 *
 * The feed is opened on mount and closed on unmount, and nothing is polled or
 * even kept by the backend in between. That is deliberate: this window was taken
 * off the telemetry bundle on purpose, and an inspector that subscribed to it
 * would hand the cost straight back.
 */
export const TelemetryInspectorSection = observer(() => {
  const inspector = useTelemetryInspectorStore();
  const { t } = useTranslation('main-app');

  useEffect(() => {
    void inspector.start();

    return () => {
      void inspector.stop();
    };
  }, [inspector]);

  return (
    <SettingsCard title={t('settingsPage.telemetryInspector.title')}>
      <div className={styles.hint}>
        {t('settingsPage.telemetryInspector.description')}
      </div>

      <div className={styles.controls}>
        <Segmented<InspectorSource>
          value={inspector.source}
          onChange={(value) => void inspector.setSource(value)}
          options={[
            {
              value: 'telemetry',
              label: t('settingsPage.telemetryInspector.sourceTelemetry'),
            },
            {
              value: 'session',
              label: t('settingsPage.telemetryInspector.sourceSession'),
            },
          ]}
        />

        <Input
          allowClear
          prefix={<Search size={14} />}
          placeholder={t('settingsPage.telemetryInspector.filterPlaceholder')}
          value={inspector.filter}
          onChange={(event) => inspector.setFilter(event.target.value)}
        />

        <div className={styles.toggle}>
          <Switch
            checked={inspector.hideAbsent}
            onChange={(checked) => inspector.setHideAbsent(checked)}
          />

          <span>
            {t('settingsPage.telemetryInspector.hideAbsent', {
              count: inspector.absentCount,
            })}
          </span>
        </div>
      </div>

      {inspector.lastError && (
        <Alert
          type="error"
          showIcon
          message={inspector.lastError}
          className={styles.alert}
        />
      )}

      {inspector.isEmpty ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t(
            inspector.source === 'session'
              ? 'settingsPage.telemetryInspector.waitingSession'
              : 'settingsPage.telemetryInspector.waiting'
          )}
        />
      ) : (
        <>
          <div className={styles.summary}>
            <Tag>
              {t('settingsPage.telemetryInspector.rowCount', {
                count: inspector.rows.length,
              })}
            </Tag>

            {inspector.absentCount > 0 && (
              <Tag color="warning">
                {t('settingsPage.telemetryInspector.absentCount', {
                  count: inspector.absentCount,
                })}
              </Tag>
            )}
          </div>

          <div className={styles.rows}>
            {inspector.rows.map((row) => (
              <InspectorRowLine key={row.path} row={row} />
            ))}
          </div>
        </>
      )}
    </SettingsCard>
  );
});
