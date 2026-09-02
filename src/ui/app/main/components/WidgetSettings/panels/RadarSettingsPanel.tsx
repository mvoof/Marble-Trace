import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Col, InputNumber, Row, Segmented, Select, Slider, Switch } from 'antd';
import type {
  BaseUserSettings,
  RadarBackgroundTexture,
  RadarQualifyingVisibility,
  RadarScaleMode,
  RadarSettings,
  ProximityRadarSettings,
} from '@/types/widget-settings';
import {
  DESIGN_SCOPE_RANGE_M,
  DESIGN_SIZE_PX,
  LADDER_STEP_M,
  rangeRingRadii,
  resolveScopeScale,
} from '@ui/widgets/ProximityRadarWidget/radar-scope-utils';
import { distanceUnit, formatDistance } from '@utils/telemetry-format';
import { useUnitsStore } from '@store/root-store-context';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['proximity-radar', 'radar-bar'];

const MIN_SCOPE_RANGE_M = 5;
const MAX_SCOPE_RANGE_M = 30;
const SCOPE_RANGE_STEP_M = 1;

const MIN_OPACITY = 0.1;
const MAX_OPACITY = 1;
const OPACITY_STEP = 0.05;

const asPercent = (opacity: number): number => Math.round(opacity * 100);

const { SwitchRow } = panelRows<ProximityRadarSettings>();

const SCALE_MODES: RadarScaleMode[] = ['fixed-scope', 'fixed-cars', 'manual'];

const TEXTURES: RadarBackgroundTexture[] = [
  'none',
  'polar-dots',
  'polar-mesh',
  'hatch',
  'scanlines',
];

/**
 * What the circle covers, in the units the user reads. The widget resolves the
 * same numbers from its rendered size, so this says exactly what the overlay
 * will draw rather than a nominal value.
 */
const ScopeReadout = observer(
  ({ settings }: { settings: BaseUserSettings & ProximityRadarSettings }) => {
    const units = useUnitsStore();
    const { t } = useTranslation('widgets');
    const { unitSystem } = units;

    const widthPx = settings.currentWidth ?? DESIGN_SIZE_PX;

    const { rangeMeters } = resolveScopeScale({
      scaleMode: settings.scaleMode,
      scopeRange: settings.scopeRange,
      radiusPx: widthPx / 2,
      widgetScale: widthPx / DESIGN_SIZE_PX,
    });

    const length = (meters: number) =>
      `${formatDistance(meters, unitSystem)}${distanceUnit(unitSystem)}`;

    const rings = rangeRingRadii(rangeMeters).map(length).join(' / ');

    return (
      <div className={styles.fieldDesc}>
        {t('settingsPanels.radar.scopeReadout', {
          range: length(rangeMeters),
          rings,
          ladder: length(LADDER_STEP_M),
        })}
      </div>
    );
  }
);

const ScopeCard = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('proximity-radar');
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<ProximityRadarSettings>(panelWidgetId);

  const update = (partial: Partial<ProximityRadarSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.radar.scope')}>
        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.scaleMode')}
            </span>
            <Select
              style={{ width: '100%' }}
              value={settings.scaleMode}
              onChange={(value: RadarScaleMode) => {
                update({ scaleMode: value });
              }}
              options={SCALE_MODES.map((mode) => ({
                label: t(`settingsPanels.radar.scaleModes.${mode}`),
                value: mode,
              }))}
            />
            <div className={styles.fieldDesc}>
              {t(`settingsPanels.radar.scaleModeDesc.${settings.scaleMode}`, {
                range: DESIGN_SCOPE_RANGE_M,
              })}
            </div>
          </Col>
        </Row>

        {settings.scaleMode === 'manual' && (
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.scopeRange')}
              </span>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.scopeRange}
                min={MIN_SCOPE_RANGE_M}
                max={MAX_SCOPE_RANGE_M}
                step={SCOPE_RANGE_STEP_M}
                onChange={(value) => {
                  if (value !== null) {
                    update({ scopeRange: value });
                  }
                }}
              />
            </Col>
          </Row>
        )}

        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <ScopeReadout settings={settings} />
          </Col>
        </Row>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showAxes"
            title={t('settingsPanels.radar.showAxes')}
            desc={t('settingsPanels.radar.showAxesDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showAxisTicks"
            title={t('settingsPanels.radar.showAxisTicks')}
            desc={t('settingsPanels.radar.showAxisTicksDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showRangeRings"
            title={t('settingsPanels.radar.showRangeRings')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="monochromeCars"
            title={t('settingsPanels.radar.monochromeCars')}
            desc={t('settingsPanels.radar.monochromeCarsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showEdgeMarkers"
            title={t('settingsPanels.radar.showEdgeMarkers')}
            desc={t('settingsPanels.radar.showEdgeMarkersDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showBeam"
            title={t('settingsPanels.radar.showBeam')}
            desc={t('settingsPanels.radar.showBeamDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldLabel}>
            {t('settingsPanels.radar.carOpacity', {
              percent: asPercent(settings.carOpacity),
            })}
          </div>
          <Slider
            min={MIN_OPACITY}
            max={MAX_OPACITY}
            step={OPACITY_STEP}
            value={settings.carOpacity}
            onChange={(value) => update({ carOpacity: value })}
          />
          <div className={styles.fieldDesc}>
            {t('settingsPanels.radar.carOpacityDesc')}
          </div>
        </div>

        {settings.showBeam && (
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              {t('settingsPanels.radar.beamOpacity', {
                percent: asPercent(settings.beamOpacity),
              })}
            </div>
            <Slider
              min={MIN_OPACITY}
              max={MAX_OPACITY}
              step={OPACITY_STEP}
              value={settings.beamOpacity}
              onChange={(value) => update({ beamOpacity: value })}
            />
            <div className={styles.fieldDesc}>
              {t('settingsPanels.radar.beamOpacityDesc')}
            </div>
          </div>
        )}
      </Card>

      <Card title={t('settingsPanels.radar.texture')}>
        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.texturePattern')}
            </span>
            <Select
              style={{ width: '100%' }}
              value={settings.backgroundTexture}
              onChange={(value: RadarBackgroundTexture) => {
                update({ backgroundTexture: value });
              }}
              options={TEXTURES.map((texture) => ({
                label: t(`settingsPanels.radar.textures.${texture}`),
                value: texture,
              }))}
            />
            <div className={styles.fieldDesc}>
              {t('settingsPanels.radar.textureDesc')}
            </div>
          </Col>
        </Row>
      </Card>
    </>
  );
});

export const RadarSettingsPanel = observer(
  ({ widgetId }: { widgetId: 'proximity-radar' | 'radar-bar' }) => {
    const widgetSettings = useWidgetEditor();
    const { t } = useTranslation('widgets');
    const settings = widgetSettings.getSettings<RadarSettings>(widgetId);

    const update = (partial: Partial<RadarSettings>) => {
      widgetSettings.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <>
        <Card title={t('settingsPanels.radar.radarBehavior')}>
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.activationRange')}
              </span>
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
              <div className={styles.fieldDesc}>
                {t('settingsPanels.radar.activationRangeDesc')}
              </div>
            </Col>

            <Col span={8}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.fadeOutDelay')}
              </span>
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

          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={24}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.showDistance')}
              </span>
              <Switch
                checked={settings.showDistance}
                onChange={(checked) => {
                  update({ showDistance: checked });
                }}
              />
            </Col>
          </Row>
        </Card>

        {widgetId === 'proximity-radar' && <ScopeCard />}

        <Card title={t('settingsPanels.radar.qualifying')}>
          <Row gutter={24} className={styles.fieldGroup}>
            <Col span={24}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.radar.showInQualifying')}
              </span>
              <Segmented
                value={settings.qualifyingVisibility}
                onChange={(v) => {
                  update({
                    qualifyingVisibility: v as RadarQualifyingVisibility,
                  });
                }}
                options={[
                  { label: t('settingsPanels.radar.always'), value: 'always' },
                  { label: t('settingsPanels.radar.auto'), value: 'auto' },
                  { label: t('settingsPanels.radar.never'), value: 'never' },
                ]}
              />
              <div className={styles.fieldDesc}>
                {t('settingsPanels.radar.autoDesc')}
              </div>
            </Col>
          </Row>
        </Card>
      </>
    );
  }
);
