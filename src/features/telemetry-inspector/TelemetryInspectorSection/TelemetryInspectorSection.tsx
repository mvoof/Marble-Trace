import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Empty,
  Input,
  Segmented,
  Switch,
  Tag,
  message,
} from 'antd';
import { Copy, Search } from 'lucide-react';

import { useTelemetryInspectorStore } from '@features/telemetry-inspector/telemetry-inspector-context';
import type {
  InspectorSource,
  RawSessionView,
} from '@features/telemetry-inspector/inspector';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { DeliveryCountersCard } from './DeliveryCountersCard';
import { InspectorRowLine } from './InspectorRowLine';
import { RawSessionText } from './RawSessionText';
import { SourceNote } from './SourceNote';
import styles from './TelemetryInspectorSection.module.scss';

const WAITING_KEYS: Record<InspectorSource, string> = {
  rawTelemetry: 'settingsPage.telemetryInspector.waitingRaw',
  rawSession: 'settingsPage.telemetryInspector.waitingSession',
  telemetry: 'settingsPage.telemetryInspector.waiting',
  session: 'settingsPage.telemetryInspector.waitingSession',
};

/**
 * Browser over what the sim sends and what the app made of it: iRacing's own
 * variables and session YAML, untouched, beside the adapted frame and the
 * parsed session.
 *
 * The raw views are the one place that can answer "does the sim report that at
 * all?"; the processed ones answer "did our adapter keep it?".
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
    void inspector.open();

    return () => {
      void inspector.close();
    };
  }, [inspector]);

  const copyYaml = async () => {
    await navigator.clipboard.writeText(inspector.rawSession?.yaml ?? '');
    void message.success(t('settingsPage.telemetryInspector.copied'));
  };

  return (
    <>
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
                value: 'rawTelemetry',
                label: t('settingsPage.telemetryInspector.sourceRawTelemetry'),
              },
              {
                value: 'rawSession',
                label: t('settingsPage.telemetryInspector.sourceRawSession'),
              },
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
        </div>

        <SourceNote />

        <div className={styles.controls}>
          <Input
            className={styles.filter}
            allowClear
            prefix={<Search size={14} />}
            placeholder={t('settingsPage.telemetryInspector.filterPlaceholder')}
            value={inspector.filter}
            onChange={(event) => inspector.setFilter(event.target.value)}
          />

          {inspector.showsAbsent && (
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
          )}

          {inspector.source === 'rawSession' && (
            <>
              <Segmented<RawSessionView>
                value={inspector.rawSessionView}
                onChange={(value) => inspector.setRawSessionView(value)}
                options={[
                  {
                    value: 'tree',
                    label: t('settingsPage.telemetryInspector.viewTree'),
                  },
                  {
                    value: 'text',
                    label: t('settingsPage.telemetryInspector.viewText'),
                  },
                ]}
              />

              <Button
                icon={<Copy size={14} />}
                disabled={inspector.rawSession === null}
                onClick={() => void copyYaml()}
              >
                {t('settingsPage.telemetryInspector.copyYaml')}
              </Button>
            </>
          )}
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
            description={t(WAITING_KEYS[inspector.source])}
          />
        ) : inspector.showsRawText ? (
          <RawSessionText />
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

      <DeliveryCountersCard />
    </>
  );
});
