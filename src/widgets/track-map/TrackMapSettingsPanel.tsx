import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Row as GridRow, Col, Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import {
  panelRows,
  usePanelWidgetId,
} from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  TRACK_MAP_SETTINGS,
  type TrackMapWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['track-map'];

const { DependentBlock } = panelRows<TrackMapWidgetSettings>();
const { Row, useLabels } = schemaRows(TRACK_MAP_SETTINGS);
const { zoomLevel, zoomCircleOpacity } = TRACK_MAP_SETTINGS.shape;

// The four stroke sizes, laid out two by two.
const STYLING_KEYS = [
  'trackStrokePx',
  'trackBorderPx',
  'sectorStrokePx',
  'targetDotRadiusPx',
] as const;

const PERCENT = 100;

// The ground's colour and opacity qualify the ground, which only exists in the
// follow view — one level of nesting, so both conditions are spelled out here.
const isCircleGroundShown = (settings: TrackMapWidgetSettings): boolean =>
  settings.zoomEnabled && settings.zoomCircleBackground;

// The marker is always drawn — there is no switch for it — so its size and the
// pit option stand on their own; only the colour gives way to the class colour.
const isOwnPaceCarColor = (settings: TrackMapWidgetSettings): boolean =>
  !settings.paceCarUseClassColor;

interface StylingCellProps {
  setting: (typeof STYLING_KEYS)[number];
}

const StylingCell = observer(({ setting }: StylingCellProps) => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('track-map');
  const { title } = useLabels(setting);
  const field = TRACK_MAP_SETTINGS.shape[setting];
  const settings =
    liveWidgets.getSettings<TrackMapWidgetSettings>(panelWidgetId);

  return (
    <Col span={12}>
      <span className={styles.fieldLabel}>{title}</span>
      <InputNumber
        style={{ width: '100%' }}
        value={settings[setting]}
        min={field.min}
        max={field.max}
        onChange={(value) =>
          value !== null &&
          liveWidgets.updateUserSettings(panelWidgetId, { [setting]: value })
        }
      />
    </Col>
  );
});

export const TrackMapSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('track-map');
  const { t } = useTranslation('widgets');
  const zoomLevelLabels = useLabels('zoomLevel');
  const opacityLabels = useLabels('zoomCircleOpacity');

  const settings =
    liveWidgets.getSettings<TrackMapWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<TrackMapWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.trackMap.visualElements')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSectorsOnMap" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showStartFinish" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="classShapes" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.qualifying')}>
        <div className={styles.fieldGroup}>
          <Row setting="qualifyingVisibility" stacked />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.zoomView')}>
        <div className={styles.fieldGroup}>
          <Row setting="zoomEnabled" />
        </div>

        <DependentBlock dependsOn="zoomEnabled">
          <span className={styles.fieldLabel}>{zoomLevelLabels.title}</span>
          <Slider
            min={zoomLevel.min}
            max={zoomLevel.max}
            step={zoomLevel.step}
            value={settings.zoomLevel}
            tooltip={{ formatter: (value) => `${value}x` }}
            onChange={(value) => update({ zoomLevel: value })}
          />
        </DependentBlock>

        <Row setting="zoomRotate" dependsOn="zoomEnabled" />
        <Row setting="zoomCircleBackground" dependsOn="zoomEnabled" />
        <Row setting="zoomCircleColor" dependsOn={isCircleGroundShown} />

        <DependentBlock dependsOn={isCircleGroundShown}>
          <span className={styles.fieldLabel}>{opacityLabels.title}</span>
          <Slider
            min={zoomCircleOpacity.min}
            max={zoomCircleOpacity.max}
            step={zoomCircleOpacity.step}
            value={settings.zoomCircleOpacity}
            tooltip={{
              formatter: (value) => `${Math.round((value ?? 0) * PERCENT)}%`,
            }}
            onChange={(value) => update({ zoomCircleOpacity: value })}
          />
        </DependentBlock>
      </Card>

      <Card title={t('settingsPanels.common.playerMarker')}>
        <div className={styles.fieldGroup}>
          <Row setting="playerDotColor" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showPlayerLabel" />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.leaderLabels')}>
        <div className={styles.fieldGroup}>
          <Row setting="leaderLabelMode" stacked />
          <Row setting="useLivePositions" />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.incidentZones')}>
        <div className={styles.fieldGroup}>
          <Row setting="flagZoneStyle" stacked />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showIncidentZones" />
        </div>

        <Row setting="blinkIncidentZones" dependsOn="showIncidentZones" />
      </Card>

      <Card title={t('settingsPanels.common.safetyCar')}>
        <div className={styles.fieldGroup}>
          <Row setting="paceCarUseClassColor" />
        </div>

        <Row setting="paceCarColor" dependsOn={isOwnPaceCarColor} />

        <div className={styles.fieldGroup}>
          <Row setting="paceCarRadiusPx" stacked input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="paceCarShowInPits" />
        </div>
      </Card>

      <Card title={t('settingsPanels.trackMap.trackStyling')}>
        <GridRow gutter={[24, 24]}>
          {STYLING_KEYS.map((setting) => (
            <StylingCell key={setting} setting={setting} />
          ))}
        </GridRow>
      </Card>
    </>
  );
});
