import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Row, Col, Segmented, Slider } from 'antd';
import {
  FlagZoneStyle,
  RadarQualifyingVisibility,
  TrackMapLeaderLabelMode,
  TrackMapWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

const MIN_ZOOM_LEVEL = 1.5;
const MAX_ZOOM_LEVEL = 10;
const ZOOM_STEP = 0.5;
const DEFAULT_ZOOM_LEVEL = 3;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['track-map'];

const { ColorRow, SwitchRow } = panelRows<TrackMapWidgetSettings>();

export const TrackMapSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('track-map');
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<TrackMapWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<TrackMapWidgetSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.trackMap.visualElements')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showSectorsOnMap"
            title={t('settingsPanels.trackMap.sectorsOnMap')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showStartFinish"
            title={t('settingsPanels.trackMap.startFinishLine')}
            fallback
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="classShapes"
            title={t('settingsPanels.trackMap.classShapes')}
            desc={t('settingsPanels.trackMap.classShapesDesc')}
            fallback={false}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.radar.qualifying')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.trackMap.showDriversInQualifying')}
          </span>
          <Segmented
            block
            value={settings.qualifyingVisibility ?? 'always'}
            options={[
              { label: t('settingsPanels.radar.always'), value: 'always' },
              { label: t('settingsPanels.radar.auto'), value: 'auto' },
              { label: t('settingsPanels.radar.never'), value: 'never' },
            ]}
            onChange={(v) =>
              update({ qualifyingVisibility: v as RadarQualifyingVisibility })
            }
          />
          <div className={styles.fieldDesc}>
            {t('settingsPanels.trackMap.showDriversInQualifyingDesc')}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.zoomView')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="zoomEnabled"
            title={t('settingsPanels.trackMap.zoomEnabled')}
            desc={t('settingsPanels.trackMap.zoomEnabledDesc')}
            fallback={false}
          />
        </div>

        {settings.zoomEnabled && (
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.trackMap.zoomLevel')}
            </span>
            <Slider
              min={MIN_ZOOM_LEVEL}
              max={MAX_ZOOM_LEVEL}
              step={ZOOM_STEP}
              value={settings.zoomLevel ?? DEFAULT_ZOOM_LEVEL}
              tooltip={{ formatter: (v) => `${v}x` }}
              onChange={(v) => update({ zoomLevel: v })}
            />
          </div>
        )}

        {settings.zoomEnabled && (
          <div className={styles.fieldGroup}>
            <SwitchRow
              settingKey="zoomRotate"
              title={t('settingsPanels.trackMap.zoomRotate')}
              desc={t('settingsPanels.trackMap.zoomRotateDesc')}
              fallback={false}
            />
          </div>
        )}
      </Card>

      <Card title={t('settingsPanels.linearMap.playerMarker')}>
        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="playerDotColor"
            title={t('settingsPanels.trackMap.playerDotColor')}
            desc={t('settingsPanels.trackMap.playerDotColorDesc')}
            hex
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPlayerLabel"
            title={t('settingsPanels.trackMap.showYouLabel')}
            desc={t('settingsPanels.trackMap.showYouLabelDesc')}
          />
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

          <SwitchRow
            settingKey="useLivePositions"
            title={t('settingsPanels.common.useLivePositions')}
            desc={t('settingsPanels.common.useLivePositionsTrackMapDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.incidentZones')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.trackMap.flagZoneStyle')}
          </span>
          <Segmented
            block
            value={settings.flagZoneStyle ?? 'filled'}
            options={[
              {
                label: t('settingsPanels.trackMap.flagZoneStyleFilled'),
                value: 'filled',
              },
              {
                label: t('settingsPanels.trackMap.flagZoneStyleOutline'),
                value: 'outline',
              },
            ]}
            onChange={(value) =>
              update({ flagZoneStyle: value as FlagZoneStyle })
            }
          />
          <span className={styles.fieldDesc}>
            {t('settingsPanels.trackMap.flagZoneStyleDesc')}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showIncidentZones"
            title={t('settingsPanels.trackMap.showIncidentZones')}
            desc={t('settingsPanels.trackMap.showIncidentZonesDesc')}
            fallback
          />
        </div>

        {(settings.showIncidentZones ?? true) && (
          <div className={styles.fieldGroup}>
            <SwitchRow
              settingKey="blinkIncidentZones"
              title={t('settingsPanels.trackMap.blinkIncidentZones')}
              fallback
            />
          </div>
        )}
      </Card>

      <Card title={t('settingsPanels.trackMap.safetyCar')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="paceCarUseClassColor"
            title={t('settingsPanels.trackMap.paceCarUseClassColor')}
            desc={t('settingsPanels.trackMap.paceCarUseClassColorDesc')}
            fallback={false}
          />
        </div>

        {!settings.paceCarUseClassColor && (
          <div className={styles.fieldGroup}>
            <ColorRow
              settingKey="paceCarColor"
              title={t('settingsPanels.trackMap.paceCarColor')}
              fallback={'#facc15'}
              hex
            />
          </div>
        )}

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.trackMap.paceCarRadius')}
          </span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.paceCarRadiusPx ?? settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ paceCarRadiusPx: v })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="paceCarShowInPits"
            title={t('settingsPanels.trackMap.paceCarShowInPits')}
            desc={t('settingsPanels.trackMap.paceCarShowInPitsDesc')}
            fallback={false}
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
