import type React from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Table, Tag } from 'antd';
import { RotateCcw } from 'lucide-react';

import { useTelemetryInspectorStore } from '@store/root-store-context';
import type { DeliveryFieldRow, DeliveryRow } from '@/types/inspector';
import { SettingsCard } from '../../SettingsCard';
import styles from './TelemetryInspectorSection.module.scss';

const MS_PER_SECOND = 1000;
/** One decimal: the question is 60 against 10 against 0, not 59.8 against 60.1. */
const HZ_DECIMALS = 1;
const SECONDS_DECIMALS = 1;

const formatHz = (hz: number): string => `${hz.toFixed(HZ_DECIMALS)} Hz`;

/**
 * Every number here is repainted four times a second. Held on a fixed monospace
 * cell so only the digits change and nothing around them is re-laid out.
 */
const Numeric = ({
  width,
  children,
}: {
  width: string;
  children: React.ReactNode;
}) => <span className={`${styles.numeric} ${width}`}>{children}</span>;

const fieldColumns = (t: (key: string) => string) => [
  {
    title: t('settingsPage.telemetryInspector.delivery.field'),
    dataIndex: 'field',
    key: 'field',
  },
  {
    title: t('settingsPage.telemetryInspector.delivery.bundles'),
    dataIndex: 'bundles',
    key: 'bundles',
    align: 'right' as const,
    render: (_value: unknown, row: DeliveryFieldRow) => (
      <Numeric width={styles.numericBundles}>{row.bundles}</Numeric>
    ),
  },
  {
    title: t('settingsPage.telemetryInspector.delivery.rate'),
    key: 'hz',
    align: 'right' as const,
    render: (_value: unknown, row: DeliveryFieldRow) => (
      <Numeric width={styles.numericRate}>{formatHz(row.hz)}</Numeric>
    ),
  },
];

/**
 * What each recipient was actually delivered — the instrument the per-window
 * mask work is measured with.
 *
 * A widget's declaration says what it *asked* for; these counts say what went on
 * the wire after the mask and the repeat suppression, which is the only thing
 * that can confirm a window stopped receiving a field.
 */
export const DeliveryCountersCard = observer(() => {
  const inspector = useTelemetryInspectorStore();
  const { t } = useTranslation('main-app');

  return (
    <SettingsCard title={t('settingsPage.telemetryInspector.delivery.title')}>
      <div className={styles.hint}>
        {t('settingsPage.telemetryInspector.delivery.description')}
      </div>

      <div className={styles.controls}>
        <Button
          icon={<RotateCcw size={14} />}
          onClick={() => void inspector.resetDelivery()}
        >
          {t('settingsPage.telemetryInspector.delivery.reset')}
        </Button>
      </div>

      {inspector.deliveryRows.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('settingsPage.telemetryInspector.delivery.waiting')}
        />
      ) : (
        inspector.deliveryRows.map((row: DeliveryRow) => (
          <div key={row.label} className={styles.deliveryLabel}>
            <div className={styles.summary}>
              <Tag>{row.label}</Tag>

              <Tag>
                <Numeric width={styles.numericBundles}>{row.bundles}</Numeric>{' '}
                {t('settingsPage.telemetryInspector.delivery.bundlesLabel')}
              </Tag>

              <Tag>
                <Numeric width={styles.numericRate}>{formatHz(row.hz)}</Numeric>
              </Tag>

              <Tag>
                {t('settingsPage.telemetryInspector.delivery.spanLabel')}{' '}
                <Numeric width={styles.numericSpan}>
                  {t('settingsPage.telemetryInspector.delivery.seconds', {
                    seconds: (row.elapsedMs / MS_PER_SECOND).toFixed(
                      SECONDS_DECIMALS
                    ),
                  })}
                </Numeric>
              </Tag>
            </div>

            <Table<DeliveryFieldRow>
              size="small"
              pagination={false}
              rowKey="field"
              columns={fieldColumns(t)}
              dataSource={row.fields}
            />
          </div>
        ))
      )}
    </SettingsCard>
  );
});
