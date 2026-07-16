import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('widgets');

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
      <Card title={t('settingsPanels.trackMap.visualElements')}>
        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.trackMap.sectorsOnMap')}>
            <Switch
              checked={settings.showSectorsOnMap}
              onChange={(v) => update({ showSectorsOnMap: v })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.trackMap.startFinishLine')}>
            <Switch
              checked={settings.showStartFinish ?? true}
              onChange={(v) => update({ showStartFinish: v })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.linearMap.playerMarker')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.trackMap.playerDotColor')}
            desc={t('settingsPanels.trackMap.playerDotColorDesc')}
          >
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.trackMap.showYouLabel')}
            desc={t('settingsPanels.trackMap.showYouLabelDesc')}
          >
            <Switch
              checked={settings.showPlayerLabel}
              onChange={(v) => update({ showPlayerLabel: v })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.leaderLabels')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.trackMap.showP1Label')}
          </span>
          <Segmented
            block
            value={settings.leaderLabelMode}
            options={[
              {
                label: t('settingsPanels.trackMap.allClasses'),
                value: 'all',
              },
              {
                label: t('settingsPanels.trackMap.ownClass'),
                value: 'own-class',
              },
              { label: t('settingsPanels.trackMap.hidden'), value: 'none' },
            ]}
            onChange={(v) =>
              update({ leaderLabelMode: v as TrackMapLeaderLabelMode })
            }
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.trackStyling')}>
        <Row gutter={[24, 24]}>
          <Col span={12}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.trackMap.trackStroke')}
            </span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackStrokePx}
              min={1}
              max={30}
              onChange={(v) => v !== null && update({ trackStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.trackMap.trackBorder')}
            </span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.trackBorderPx}
              min={0}
              max={20}
              onChange={(v) => v !== null && update({ trackBorderPx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.trackMap.sectorStroke')}
            </span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.sectorStrokePx}
              min={1}
              max={20}
              onChange={(v) => v !== null && update({ sectorStrokePx: v })}
            />
          </Col>

          <Col span={12}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.trackMap.targetDotRadius')}
            </span>
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
