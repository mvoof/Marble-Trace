import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Col, InputNumber, Row as GridRow, Select, Slider } from 'antd';
import type { BaseUserSettings } from '@shared/contracts/widget-settings';
import {
  axisLabelStep,
  axisLabelText,
  rangeRingRadii,
} from '@entities/radar/radar-scope-utils';
import { scopeRangeMeters } from '@entities/radar/radar-constants';
import { distanceUnit, formatDistance } from '@shared/lib/telemetry-format';
import { useUnitsStore } from '@entities/app-settings/units-context';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '../Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from '../setting-rows';
import { schemaRows } from '../schema-rows';
import {
  PROXIMITY_RADAR_SETTINGS,
  RADAR_BACKGROUND_TEXTURE,
  type ProximityRadarSettings,
  type RadarBackgroundTexture,
} from '@entities/radar/radar.settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['proximity-radar', 'radar-bar'];

const asPercent = (opacity: number): number => Math.round(opacity * 100);

const { DependentBlock } = panelRows<ProximityRadarSettings>();
const { Row } = schemaRows(PROXIMITY_RADAR_SETTINGS);
const { hideDelay, scopeRange, carOpacity, beamOpacity } =
  PROXIMITY_RADAR_SETTINGS.shape;

/**
 * What the circle covers, in the units the user reads — the same numbers the
 * overlay draws with.
 */
const ScopeReadout = observer(
  ({ settings }: { settings: BaseUserSettings & ProximityRadarSettings }) => {
    const units = useUnitsStore();
    const { t } = useTranslation('widgets');
    const { unitSystem } = units;

    const rangeMeters = scopeRangeMeters(settings.scopeRange);

    const length = (meters: number) =>
      `${formatDistance(meters, unitSystem)}${distanceUnit(unitSystem)}`;

    const rings = rangeRingRadii(rangeMeters).map(length).join(' / ');

    return (
      <div className={styles.fieldDesc}>
        {t('settingsPanels.radar.scopeReadout', {
          range: length(rangeMeters),
          rings,
          ladder: axisLabelText(
            axisLabelStep(rangeMeters, unitSystem),
            unitSystem
          ),
        })}
      </div>
    );
  }
);

const ScopeCard = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('proximity-radar');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<ProximityRadarSettings>(panelWidgetId);

  const update = (partial: Partial<ProximityRadarSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.radar.scope')}>
        <GridRow gutter={24} className={styles.fieldGroup}>
          <Col span={8}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.scopeRange')}
            </span>
            <InputNumber
              style={{ width: '100%' }}
              value={settings.scopeRange}
              min={scopeRange.min}
              max={scopeRange.max}
              step={scopeRange.step}
              onChange={(value) => {
                if (value !== null) {
                  update({ scopeRange: value });
                }
              }}
            />
          </Col>
        </GridRow>

        <GridRow gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <ScopeReadout settings={settings} />
          </Col>
        </GridRow>

        <div className={styles.fieldGroup}>
          <Row setting="showAxes" />
        </div>

        <Row setting="showAxisTicks" dependsOn="showAxes" />

        <div className={styles.fieldGroup}>
          <Row setting="showRangeRings" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showOpponentCars" />
        </div>

        <Row setting="monochromeCars" dependsOn="showOpponentCars" />

        <Row setting="showCarNumber" dependsOn="showOpponentCars" />

        <div className={styles.fieldGroup}>
          <Row setting="showEdgeMarkers" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showBeam" />
        </div>

        <Row setting="showBeamEdge" dependsOn="showBeam" />

        <DependentBlock dependsOn="showBeam">
          <div className={styles.fieldLabel}>
            {t('settingsPanels.radar.beamOpacity', {
              percent: asPercent(settings.beamOpacity),
            })}
          </div>
          <Slider
            min={beamOpacity.min}
            max={beamOpacity.max}
            step={beamOpacity.step}
            value={settings.beamOpacity}
            onChange={(value) => update({ beamOpacity: value })}
          />
          <div className={styles.fieldDesc}>
            {t('settingsPanels.radar.beamOpacityDesc')}
          </div>
        </DependentBlock>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.radar.carOpacity', {
              percent: asPercent(settings.carOpacity),
            })}
          </div>
          <Slider
            min={carOpacity.min}
            max={carOpacity.max}
            step={carOpacity.step}
            value={settings.carOpacity}
            onChange={(value) => update({ carOpacity: value })}
          />
          <div className={styles.fieldDesc}>
            {t('settingsPanels.radar.carOpacityDesc')}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.radar.texture')}>
        <GridRow gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.backgroundTexture')}
            </span>
            <Select
              style={{ width: '100%' }}
              value={settings.backgroundTexture}
              onChange={(value: RadarBackgroundTexture) => {
                update({ backgroundTexture: value });
              }}
              options={RADAR_BACKGROUND_TEXTURE.map((texture) => ({
                label: t(`settingsPanels.radar.textures.${texture}`),
                value: texture,
              }))}
            />
            <div className={styles.fieldDesc}>
              {t('settingsPanels.radar.backgroundTextureDesc')}
            </div>
          </Col>
        </GridRow>
      </Card>
    </>
  );
});

export const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: string }) => {
    const liveWidgets = useWidgetEditor();
    const widgetType = liveWidgets.getWidget(widgetId)?.type ?? widgetId;
    const { t } = useTranslation('widgets');

    // The fade-out is the scope's alone, so it is read and written through the
    // narrower type rather than widening the pair's shared contract again.
    const scopeSettings =
      liveWidgets.getSettings<ProximityRadarSettings>(widgetId);

    const updateScope = (partial: Partial<ProximityRadarSettings>) => {
      liveWidgets.updateUserSettings(widgetId, {
        ...scopeSettings,
        ...partial,
      });
    };

    return (
      <>
        <Card title={t('settingsPanels.radar.radarBehavior')}>
          <GridRow gutter={24} className={styles.fieldGroup}>
            <Col span={24}>
              <div className={styles.fieldDesc}>
                {t(
                  widgetType === 'proximity-radar'
                    ? 'settingsPanels.radar.scopeActivationDesc'
                    : 'settingsPanels.radar.barActivationDesc'
                )}
              </div>
            </Col>
          </GridRow>

          {widgetType === 'proximity-radar' && (
            <GridRow gutter={24} className={styles.fieldGroup}>
              <Col span={8}>
                <span className={styles.fieldLabel}>
                  {t('settingsPanels.radar.hideDelay')}
                </span>
                <InputNumber
                  style={{ width: '100%' }}
                  value={scopeSettings.hideDelay}
                  min={hideDelay.min}
                  max={hideDelay.max}
                  step={hideDelay.step}
                  onChange={(v) => {
                    if (v !== null) {
                      updateScope({ hideDelay: v });
                    }
                  }}
                />
                <div className={styles.fieldDesc}>
                  {t('settingsPanels.radar.hideDelayDesc')}
                </div>
              </Col>
            </GridRow>
          )}

          <div className={styles.fieldGroup}>
            <Row setting="showDistance" />
          </div>
        </Card>

        {widgetType === 'proximity-radar' && <ScopeCard />}

        <Card title={t('settingsPanels.common.qualifying')}>
          <div className={styles.fieldGroup}>
            <Row setting="qualifyingVisibility" stacked />
          </div>
        </Card>
      </>
    );
  }
);
