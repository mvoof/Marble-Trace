import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Col, InputNumber, Row, Segmented, Switch } from 'antd';
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
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['proximity-radar', 'radar-bar'];

const MIN_SCOPE_RANGE_M = 5;
const MAX_SCOPE_RANGE_M = 30;
const SCOPE_RANGE_STEP_M = 1;

const TEXTURE_OPACITY_PERCENT_STEP = 2;
const MAX_TEXTURE_OPACITY_PERCENT = 40;

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
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<ProximityRadarSettings>('proximity-radar');

  const update = (partial: Partial<ProximityRadarSettings>) => {
    widgetSettings.updateUserSettings('proximity-radar', {
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
            <Segmented
              value={settings.scaleMode}
              onChange={(value) => {
                update({ scaleMode: value as RadarScaleMode });
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
            settingKey="showRangeRings"
            title={t('settingsPanels.radar.showRangeRings')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showBeam"
            title={t('settingsPanels.radar.showBeam')}
            desc={t('settingsPanels.radar.showBeamDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.radar.texture')}>
        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={24}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.texturePattern')}
            </span>
            <Segmented
              value={settings.backgroundTexture}
              onChange={(value) => {
                update({ backgroundTexture: value as RadarBackgroundTexture });
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

        <Row gutter={24} className={styles.fieldGroup}>
          <Col span={8}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.radar.textureOpacity')}
            </span>
            <InputNumber
              style={{ width: '100%' }}
              value={Math.round(settings.textureOpacity * 100)}
              min={0}
              max={MAX_TEXTURE_OPACITY_PERCENT}
              step={TEXTURE_OPACITY_PERCENT_STEP}
              disabled={settings.backgroundTexture === 'none'}
              onChange={(value) => {
                if (value !== null) {
                  update({ textureOpacity: value / 100 });
                }
              }}
            />
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
