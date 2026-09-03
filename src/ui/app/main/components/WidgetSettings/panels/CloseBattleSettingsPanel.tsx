import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider } from 'antd';

import type {
  RadarQualifyingVisibility,
  CloseBattleWidgetSettings,
  BattleNameMode,
  BattleOtherClass,
  BattleSides,
  BattleTrigger,
} from '@/types/widget-settings';
import { useUnitsStore } from '@store/root-store-context';
import {
  NAME_COLUMN_MAX_PX,
  NAME_COLUMN_MIN_PX,
  toDisplayDistance,
  toMeters,
} from '@ui/widgets/CloseBattleWidget/close-battle-utils';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

const ROW_COUNTS = [1, 2, 3];

/** What the picker shows for a settings file written before the color existed. */
const PLAYER_LINE_FALLBACK_COLOR = '#ffffff';

/**
 * Meters — the number is always stored metric, whatever the user reads. The
 * lower bound is the radar's: below 5 m you are already touching.
 */
const MIN_DISTANCE_THRESHOLD = 5;
const MAX_DISTANCE_THRESHOLD = 200;

/** Feet round to fives, so the field steps by five of whatever it shows. */
const DISTANCE_STEP = 5;

const NAME_COLUMN_STEP_PX = 5;
const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['close-battle'];

const { SwitchRow, ColorRow } = panelRows<CloseBattleWidgetSettings>();

export const CloseBattleSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('close-battle');
  const units = useUnitsStore();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<CloseBattleWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<CloseBattleWidgetSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  const isGapTrigger = settings.trigger === 'gap';
  const isMetric = units.isMetric;

  // The field shows the unit the widget draws in and stores meters regardless,
  // so switching the unit system never rewrites what the user chose.
  const asDisplay = (meters: number) =>
    Math.round(toDisplayDistance(meters, isMetric));

  return (
    <>
      <Card title={t('settingsPanels.closeBattle.appearsWhen')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.trigger')}
            desc={t('settingsPanels.closeBattle.triggerDesc')}
          >
            <Segmented<BattleTrigger>
              value={settings.trigger}
              onChange={(value) => update({ trigger: value })}
              options={[
                { label: t('settingsPanels.closeBattle.gap'), value: 'gap' },
                {
                  label: t('settingsPanels.closeBattle.distance'),
                  value: 'distance',
                },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={
              isGapTrigger
                ? t('settingsPanels.closeBattle.thresholdSeconds')
                : t('settingsPanels.closeBattle.thresholdDistance', {
                    unit: isMetric ? 'm' : 'ft',
                  })
            }
            desc={t('settingsPanels.closeBattle.thresholdDesc')}
          >
            {/* Each trigger keeps its own number: seconds and meters share no
                range, so one field would show 5 as invalid the moment the
                trigger flips. */}
            {isGapTrigger ? (
              <InputNumber
                value={settings.gapThreshold}
                min={0.5}
                max={5}
                step={0.5}
                onChange={(value) => {
                  if (value !== null) {
                    update({ gapThreshold: value });
                  }
                }}
              />
            ) : (
              <InputNumber
                value={asDisplay(settings.distanceThreshold)}
                min={asDisplay(MIN_DISTANCE_THRESHOLD)}
                max={asDisplay(MAX_DISTANCE_THRESHOLD)}
                step={DISTANCE_STEP}
                onChange={(value) => {
                  if (value !== null) {
                    update({ distanceThreshold: toMeters(value, isMetric) });
                  }
                }}
              />
            )}
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.hideDelay')}
            desc={t('settingsPanels.closeBattle.hideDelayDesc')}
          >
            <InputNumber
              value={settings.hideDelay}
              min={0}
              max={15}
              step={0.5}
              onChange={(value) => {
                if (value !== null) {
                  update({ hideDelay: value });
                }
              }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.closeBattle.sides')}>
            <Segmented<BattleSides>
              value={settings.sides}
              onChange={(value) => update({ sides: value })}
              options={[
                { label: t('settingsPanels.closeBattle.both'), value: 'both' },
                {
                  label: t('settingsPanels.closeBattle.ahead'),
                  value: 'ahead',
                },
                {
                  label: t('settingsPanels.closeBattle.behind'),
                  value: 'behind',
                },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.maxRows')}
            desc={t('settingsPanels.closeBattle.maxRowsDesc')}
          >
            <Segmented<number>
              value={settings.maxRows}
              onChange={(value) => update({ maxRows: value })}
              options={ROW_COUNTS}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.otherClass')}
            desc={t('settingsPanels.closeBattle.otherClassDesc')}
          >
            <Segmented<BattleOtherClass>
              value={settings.otherClass}
              onChange={(value) => update({ otherClass: value })}
              options={[
                { label: t('settingsPanels.closeBattle.show'), value: 'show' },
                { label: t('settingsPanels.closeBattle.dim'), value: 'dim' },
                { label: t('settingsPanels.closeBattle.hide'), value: 'hide' },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="hideInPits"
            title={t('settingsPanels.closeBattle.hideInPits')}
            desc={t('settingsPanels.closeBattle.hideInPitsDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="raceOnly"
            title={t('settingsPanels.closeBattle.raceOnly')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.radar.qualifying')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.radar.showInQualifying')}
            desc={t('settingsPanels.radar.autoDesc')}
          >
            <Segmented<RadarQualifyingVisibility>
              value={settings.qualifyingVisibility}
              onChange={(value) => update({ qualifyingVisibility: value })}
              options={[
                { label: t('settingsPanels.radar.always'), value: 'always' },
                { label: t('settingsPanels.radar.auto'), value: 'auto' },
                { label: t('settingsPanels.radar.never'), value: 'never' },
              ]}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.closeBattle.axis')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.glowRange')}
            desc={t('settingsPanels.closeBattle.glowRangeDesc')}
          >
            <InputNumber
              value={settings.glowRange}
              min={0}
              max={100}
              step={5}
              onChange={(value) => {
                if (value !== null) {
                  update({ glowRange: value });
                }
              }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showAxis"
            title={t('settingsPanels.closeBattle.showAxis')}
            desc={t('settingsPanels.closeBattle.showAxisDesc')}
            fallback
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showTicks"
            title={t('settingsPanels.closeBattle.showTicks')}
            disabled={settings.showAxis === false}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showTickLabels"
            title={t('settingsPanels.closeBattle.showTickLabels')}
            disabled={settings.showAxis === false || !settings.showTicks}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showPlayerLine"
            title={t('settingsPanels.closeBattle.showPlayerLine')}
            desc={t('settingsPanels.closeBattle.showPlayerLineDesc')}
            fallback
          />
        </div>

        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="playerLineColor"
            title={t('settingsPanels.closeBattle.playerLineColor')}
            disabled={settings.showPlayerLine === false}
            fallback={PLAYER_LINE_FALLBACK_COLOR}
            hex
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="compactMode"
            title={t('settingsPanels.closeBattle.compactMode')}
            desc={t('settingsPanels.closeBattle.compactModeDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.closeBattle.plates')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showDistance"
            title={t('settingsPanels.closeBattle.showDistance')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showLapGap"
            title={t('settingsPanels.closeBattle.showLapGap')}
            desc={t('settingsPanels.closeBattle.showLapGapDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showBrand"
            title={t('settingsPanels.closeBattle.showBrand')}
            desc={t('settingsPanels.closeBattle.showBrandDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showClassBadge"
            title={t('settingsPanels.closeBattle.showClassBadge')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.nameMode')}
            desc={t('settingsPanels.closeBattle.nameModeDesc')}
          >
            <Segmented<BattleNameMode>
              value={settings.nameMode}
              onChange={(value) => update({ nameMode: value })}
              options={[
                {
                  label: t('settingsPanels.closeBattle.nameSurname'),
                  value: 'surname',
                },
                {
                  label: t('settingsPanels.closeBattle.nameInitial'),
                  value: 'initial',
                },
                {
                  label: t('settingsPanels.closeBattle.nameFull'),
                  value: 'full',
                },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.common.nameColumnWidth')}
            desc={t('settingsPanels.common.nameColumnWidthDesc')}
          >
            <Slider
              style={{ width: NAME_COLUMN_SLIDER_WIDTH_PX }}
              min={NAME_COLUMN_MIN_PX}
              max={NAME_COLUMN_MAX_PX}
              step={NAME_COLUMN_STEP_PX}
              value={settings.nameColumnWidth}
              tooltip={{ formatter: (value) => `${value ?? 0} px` }}
              onChange={(value) => update({ nameColumnWidth: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.plateOpacity')}
            desc={t('settingsPanels.closeBattle.plateOpacityDesc')}
          >
            <Slider
              style={{ width: 160 }}
              min={0.3}
              max={1}
              step={0.05}
              value={settings.plateOpacity}
              tooltip={{
                formatter: (value) => `${Math.round((value ?? 1) * 100)}%`,
              }}
              onChange={(value) => update({ plateOpacity: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="mergeOverlapping"
            title={t('settingsPanels.closeBattle.mergeOverlapping')}
            desc={t('settingsPanels.closeBattle.mergeOverlappingDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.mergeDistance')}
            desc={t('settingsPanels.closeBattle.mergeDistanceDesc')}
          >
            <InputNumber
              value={settings.mergeDistance}
              min={0.5}
              max={10}
              step={0.5}
              disabled={!settings.mergeOverlapping}
              onChange={(value) => {
                if (value !== null) {
                  update({ mergeDistance: value });
                }
              }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="scaleByDistance"
            title={t('settingsPanels.closeBattle.scaleByDistance')}
            desc={t('settingsPanels.closeBattle.scaleByDistanceDesc')}
          />
        </div>
      </Card>
    </>
  );
});
