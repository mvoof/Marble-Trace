import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Row, Col, Segmented, Switch } from 'antd';
import {
  TrackMapLeaderLabelMode,
  TrackMapWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const TrackMapSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings =
    widgetSettings.getSettings<TrackMapWidgetSettings>('track-map');

  const update = (partial: Partial<TrackMapWidgetSettings>) => {
    widgetSettings.updateUserSettings('track-map', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="Visual Elements">
        <div className={styles.fieldGroup}>
          <SettingRow title="Sectors on Map">
            <Switch
              checked={settings.showSectorsOnMap}
              onChange={(v) => update({ showSectorsOnMap: v })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title="Start/Finish Line">
            <Switch
              checked={settings.showStartFinish ?? true}
              onChange={(v) => update({ showStartFinish: v })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Player Marker">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Player Dot Color"
            desc="Ping ring and label pill color for your car."
          >
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title='Show "YOU" Label'
            desc="Display the label above your car dot."
          >
            <Switch
              checked={settings.showPlayerLabel}
              onChange={(v) => update({ showPlayerLabel: v })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title="Leader Labels">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Show P1 Label</span>
          <Segmented
            block
            value={settings.leaderLabelMode}
            options={[
              { label: 'All Classes', value: 'all' },
              { label: 'Own Class', value: 'own-class' },
              { label: 'Hidden', value: 'none' },
            ]}
            onChange={(v) =>
              update({ leaderLabelMode: v as TrackMapLeaderLabelMode })
            }
          />
        </div>
      </Card>

      <Card title="Track Styling">
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <span className={styles.fieldLabel}>Track Stroke (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackStrokePx}
              min={1}
              max={30}
              onChange={(v) => v !== null && update({ trackStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Track Border (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackBorderPx}
              min={0}
              max={20}
              onChange={(v) => v !== null && update({ trackBorderPx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Sector Stroke (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.sectorStrokePx}
              min={1}
              max={20}
              onChange={(v) => v !== null && update({ sectorStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>Target Dot Radius (px)</span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.targetDotRadiusPx}
              min={1}
              max={30}
              onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
            />
          </Col>
        </Row>
      </Card>
    </>
  );
});
