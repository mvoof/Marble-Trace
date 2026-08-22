import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider, Switch } from 'antd';

import type {
  RadarQualifyingVisibility,
  DuelBarWidgetSettings,
  DuelNameMode,
  DuelOtherClass,
  DuelSides,
  DuelTrigger,
} from '@/types/widget-settings';
import { useUnitsStore } from '@store/root-store-context';
import {
  toDisplayDistance,
  toMeters,
} from '@ui/widgets/DuelBarWidget/duel-bar-utils';
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

export const DuelBarSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const units = useUnitsStore();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<DuelBarWidgetSettings>('duel-bar');

  const update = (partial: Partial<DuelBarWidgetSettings>) => {
    widgetSettings.updateUserSettings('duel-bar', { ...settings, ...partial });
  };

  const isGapTrigger = settings.trigger === 'gap';
  const isMetric = units.isMetric;

  // The field shows the unit the widget draws in and stores meters regardless,
  // so switching the unit system never rewrites what the user chose.
  const asDisplay = (meters: number) =>
    Math.round(toDisplayDistance(meters, isMetric));

  return (
    <>
      <Card title={t('settingsPanels.duelBar.appearsWhen')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.trigger')}
            desc={t('settingsPanels.duelBar.triggerDesc')}
          >
            <Segmented<DuelTrigger>
              value={settings.trigger}
              onChange={(value) => update({ trigger: value })}
              options={[
                { label: t('settingsPanels.duelBar.gap'), value: 'gap' },
                {
                  label: t('settingsPanels.duelBar.distance'),
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
                ? t('settingsPanels.duelBar.thresholdSeconds')
                : t('settingsPanels.duelBar.thresholdDistance', {
                    unit: isMetric ? 'm' : 'ft',
                  })
            }
            desc={t('settingsPanels.duelBar.thresholdDesc')}
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
            title={t('settingsPanels.duelBar.hideDelay')}
            desc={t('settingsPanels.duelBar.hideDelayDesc')}
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
          <SettingRow title={t('settingsPanels.duelBar.sides')}>
            <Segmented<DuelSides>
              value={settings.sides}
              onChange={(value) => update({ sides: value })}
              options={[
                { label: t('settingsPanels.duelBar.both'), value: 'both' },
                { label: t('settingsPanels.duelBar.ahead'), value: 'ahead' },
                { label: t('settingsPanels.duelBar.behind'), value: 'behind' },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.maxRows')}
            desc={t('settingsPanels.duelBar.maxRowsDesc')}
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
            title={t('settingsPanels.duelBar.otherClass')}
            desc={t('settingsPanels.duelBar.otherClassDesc')}
          >
            <Segmented<DuelOtherClass>
              value={settings.otherClass}
              onChange={(value) => update({ otherClass: value })}
              options={[
                { label: t('settingsPanels.duelBar.show'), value: 'show' },
                { label: t('settingsPanels.duelBar.dim'), value: 'dim' },
                { label: t('settingsPanels.duelBar.hide'), value: 'hide' },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.hideInPits')}
            desc={t('settingsPanels.duelBar.hideInPitsDesc')}
          >
            <Switch
              checked={settings.hideInPits}
              onChange={(checked) => update({ hideInPits: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.duelBar.raceOnly')}>
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

      <Card title={t('settingsPanels.duelBar.axis')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.glowRange')}
            desc={t('settingsPanels.duelBar.glowRangeDesc')}
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
          <SettingRow title={t('settingsPanels.duelBar.showTicks')}>
            <Switch
              checked={settings.showTicks}
              onChange={(checked) => update({ showTicks: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.duelBar.showTickLabels')}>
            <Switch
              checked={settings.showTickLabels}
              disabled={!settings.showTicks}
              onChange={(checked) => update({ showTickLabels: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.compactMode')}
            desc={t('settingsPanels.duelBar.compactModeDesc')}
          >
            <Switch
              checked={settings.compactMode}
              onChange={(checked) => update({ compactMode: checked })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.duelBar.plates')}>
        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.duelBar.showDistance')}>
            <Switch
              checked={settings.showDistance}
              onChange={(checked) => update({ showDistance: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow title={t('settingsPanels.duelBar.showClassBadge')}>
            <Switch
              checked={settings.showClassBadge}
              onChange={(checked) => update({ showClassBadge: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.nameMode')}
            desc={t('settingsPanels.duelBar.nameModeDesc')}
          >
            <Segmented<DuelNameMode>
              value={settings.nameMode}
              onChange={(value) => update({ nameMode: value })}
              options={[
                {
                  label: t('settingsPanels.duelBar.nameSurname'),
                  value: 'surname',
                },
                {
                  label: t('settingsPanels.duelBar.nameInitial'),
                  value: 'initial',
                },
                { label: t('settingsPanels.duelBar.nameFull'), value: 'full' },
              ]}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.plateOpacity')}
            desc={t('settingsPanels.duelBar.plateOpacityDesc')}
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
            title={t('settingsPanels.duelBar.mergeOverlapping')}
            desc={t('settingsPanels.duelBar.mergeOverlappingDesc')}
          >
            <Switch
              checked={settings.mergeOverlapping}
              onChange={(checked) => update({ mergeOverlapping: checked })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.duelBar.mergeDistance')}
            desc={t('settingsPanels.duelBar.mergeDistanceDesc')}
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
            title={t('settingsPanels.duelBar.scaleByDistance')}
            desc={t('settingsPanels.duelBar.scaleByDistanceDesc')}
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
