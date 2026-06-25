import { observer } from 'mobx-react-lite';
import { Col, InputNumber, Row, Segmented } from 'antd';
import type {
  RadarQualifyingVisibility,
  RadarSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: 'proximity-radar' | 'radar-bar' }) => {
    const widgetSettings = useWidgetSettingsStore();
    const settings = widgetSettings.getSettings<RadarSettings>(widgetId);

    const update = (partial: Partial<RadarSettings>) => {
      widgetSettings.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <>
        <Card title="Radar Behavior">
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={8}>
              <span className={styles.fieldLabel}>Activation Range (m)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.proximityThreshold}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) => {
                  if (v !== null) {
                    update({ proximityThreshold: v });
                  }
                }}
              />
            </Col>

            <Col span={8}>
              <span className={styles.fieldLabel}>Fade Out Delay (s)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.hideDelay}
                min={0}
                max={30}
                step={0.5}
                onChange={(v) => {
                  if (v !== null) {
                    update({ hideDelay: v });
                  }
                }}
              />
            </Col>

            <Col span={8}>
              <span className={styles.fieldLabel}>Car Length (m)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.carLength}
                min={1}
                max={10}
                step={0.1}
                onChange={(v) => {
                  if (v !== null) {
                    update({ carLength: v });
                  }
                }}
              />
            </Col>
          </Row>
        </Card>

        <Card title="Qualifying">
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={24}>
              <span className={styles.fieldLabel}>Show in qualifying</span>
              <Segmented
                value={settings.qualifyingVisibility}
                onChange={(v) => {
                  update({
                    qualifyingVisibility: v as RadarQualifyingVisibility,
                  });
                }}
                options={[
                  { label: 'Always', value: 'always' },
                  { label: 'Auto', value: 'auto' },
                  { label: 'Never', value: 'never' },
                ]}
              />
              <div className={styles.fieldDesc}>
                Auto: hidden during lone qualifying (single car on track)
              </div>
            </Col>
          </Row>
        </Card>
      </>
    );
  }
);
