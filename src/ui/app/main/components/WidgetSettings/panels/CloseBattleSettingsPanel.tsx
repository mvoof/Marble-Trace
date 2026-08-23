import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider, Switch } from 'antd';

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
  toDisplayDistance,
  toMeters,
} from '@ui/widgets/CloseBattleWidget/close-battle-utils';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

const ROW_COUNTS = [1, 2, 3];

/**
 * Meters — the number is always stored metric, whatever the user reads. The
 * lower bound is the radar's: below 5 m you are already touching.
 */
const MIN_DISTANCE_THRESHOLD = 5;
const MAX_DISTANCE_THRESHOLD = 200;

/** Feet round to fives, so the field steps by five of whatever it shows. */
const DISTANCE_STEP = 5;

export const CloseBattleSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const units = useUnitsStore();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<CloseBattleWidgetSettings>('close-battle');

  const update = (partial: Partial<CloseBattleWidgetSettings>) => {
    widgetSettings.updateUserSettings('close-battle', {
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
          <SettingRow
            title={t('settingsPanels.closeBattle.hideInPits')}
            desc={t('settingsPanels.closeBattle.hideInPitsDesc')}
          >
            <Switch
              checked={settings.hideInPits}
              onChange={(checked) => update({ hideInPits: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.closeBattle.raceOnly')}>
            <Switch
              checked={settings.raceOnly}
              onChange={(checked) => update({ raceOnly: checked })}
            />
          </SettingRow>
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
          <SettingRow title={t('settingsPanels.closeBattle.showTicks')}>
            <Switch
              checked={settings.showTicks}
              onChange={(checked) => update({ showTicks: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.closeBattle.showTickLabels')}>
            <Switch
              checked={settings.showTickLabels}
              disabled={!settings.showTicks}
              onChange={(checked) => update({ showTickLabels: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.compactMode')}
            desc={t('settingsPanels.closeBattle.compactModeDesc')}
          >
            <Switch
              checked={settings.compactMode}
              onChange={(checked) => update({ compactMode: checked })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.closeBattle.plates')}>
        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.closeBattle.showDistance')}>
            <Switch
              checked={settings.showDistance}
              onChange={(checked) => update({ showDistance: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.showLapGap')}
            desc={t('settingsPanels.closeBattle.showLapGapDesc')}
          >
            <Switch
              checked={settings.showLapGap}
              onChange={(checked) => update({ showLapGap: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.closeBattle.showBrand')}
            desc={t('settingsPanels.closeBattle.showBrandDesc')}
          >
            <Switch
              checked={settings.showBrand}
              onChange={(checked) => update({ showBrand: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.closeBattle.showClassBadge')}>
            <Switch
              checked={settings.showClassBadge}
              onChange={(checked) => update({ showClassBadge: checked })}
            />
          </SettingRow>
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
          <SettingRow
            title={t('settingsPanels.closeBattle.mergeOverlapping')}
            desc={t('settingsPanels.closeBattle.mergeOverlappingDesc')}
          >
            <Switch
              checked={settings.mergeOverlapping}
              onChange={(checked) => update({ mergeOverlapping: checked })}
            />
          </SettingRow>
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
          <SettingRow
            title={t('settingsPanels.closeBattle.scaleByDistance')}
            desc={t('settingsPanels.closeBattle.scaleByDistanceDesc')}
          >
            <Switch
              checked={settings.scaleByDistance}
              onChange={(checked) => update({ scaleByDistance: checked })}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});
