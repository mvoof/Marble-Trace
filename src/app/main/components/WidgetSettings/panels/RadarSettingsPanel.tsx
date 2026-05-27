import { observer } from 'mobx-react-lite';
import { Col, InputNumber, Row } from 'antd';
import type { RadarSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './shared';
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
      <Card title="Radar Behavior">
        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={12}>
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

          <Col span={12}>
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
        </Row>
      </Card>
    );
  }
);
