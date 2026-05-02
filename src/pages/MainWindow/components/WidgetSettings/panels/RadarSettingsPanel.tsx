import { observer } from 'mobx-react-lite';
import { Col, InputNumber, Row, Segmented } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  RadarBarDisplayMode,
  RadarSettings,
  RadarVisibilityMode,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: 'proximity-radar' | 'radar-bar' }) => {
    const settings = widgetSettingsStore.getRadarSettings(widgetId);

    const update = (partial: Partial<RadarSettings>) => {
      widgetSettingsStore.updateCustomSettings(widgetId, {
        [widgetId]: { ...settings, ...partial },
      });
    };

    return (
      <Card title="Radar Behavior">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Visibility Logic</span>
          <Segmented
            block
            value={settings.visibilityMode}
            options={[
              { label: 'Always Visible', value: 'always' },
              { label: 'On Proximity Only', value: 'proximity' },
            ]}
            onChange={(v) =>
              update({ visibilityMode: v as RadarVisibilityMode })
            }
          />
        </div>

        {settings.visibilityMode === 'proximity' && (
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={12}>
              <span className={styles.fieldLabel}>Activation Range (m)</span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.proximityThreshold}
                min={1}
                max={20}
                step={0.5}
                onChange={(v) =>
                  v !== null && update({ proximityThreshold: v })
                }
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
                onChange={(v) => v !== null && update({ hideDelay: v })}
              />
            </Col>
          </Row>
        )}

        {widgetId === 'radar-bar' && (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Bar Display Mode</span>
            <Segmented
              block
              value={settings.barDisplayMode ?? 'both'}
              options={[
                { label: 'Show Both Sides', value: 'both' },
                { label: 'Active Side Only', value: 'active-only' },
              ]}
              onChange={(v) =>
                update({ barDisplayMode: v as RadarBarDisplayMode })
              }
            />
          </div>
        )}
      </Card>
    );
  }
);
