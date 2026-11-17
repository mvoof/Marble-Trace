import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { schemaRows } from '@features/widget-settings/schema-rows';
import type { SwitchKey } from '@features/widget-settings/setting-rows';
import {
  RELATIVE_SETTINGS,
  type RelativeWidgetSettings,
} from './settings-schema';
import type { RelativeColumn } from './relative-columns';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['relative'];

const { Row, ColumnRows, useLabels } = schemaRows(RELATIVE_SETTINGS);

// The switch that draws each column; position, name and gap always show.
const COLUMN_TOGGLES: Record<
  RelativeColumn,
  SwitchKey<RelativeWidgetSettings>
> = {
  pos: 'showPosition',
  carNumber: 'showCarNumber',
  countryFlag: 'showCountryFlag',
  name: 'showDriverName',
  sr: 'showLicBadge',
  ir: 'showIRating',
  gap: 'showGap',
  distance: 'showDistance',
};
const { nameColumnWidth } = RELATIVE_SETTINGS.shape;

const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

export const RelativeSettingsPanel = observer(() => {
  const [settings, update] =
    usePanelSettings<RelativeWidgetSettings>('relative');
  const { t } = useTranslation('widgets');
  const nameColumnLabels = useLabels('nameColumnWidth');

  return (
    <>
      <Card group="columns">
        <ColumnRows setting="columnOrder" toggles={COLUMN_TOGGLES} />
      </Card>

      <Card group="content">
        <div className={styles.fieldGroup}>
          <Row setting="qualifyingVisibility" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.driverName')}>
        <Row setting="abbreviateNames" />
        <Row setting="showDriverFlags" />
        <Row setting="showRadioMark" />
        <Row setting="showPitIndicator" />
      </Card>

      {/* Greyed rather than hidden while their column is off, so the block keeps its shape. */}
      <Card title={t('settingsPanels.common.ratings')}>
        <Row setting="licBadgeStyle" disabled={!settings.showLicBadge} />
        <Row setting="showLicenseLetter" disabled={!settings.showLicBadge} />
        <Row
          setting="showSafetyRatingValue"
          dependsOn="showLicenseLetter"
          disabled={!settings.showLicBadge}
        />
        <Row setting="abbreviateIRating" disabled={!settings.showIRating} />
        <Row setting="showIRatingChip" disabled={!settings.showIRating} />
      </Card>

      <Card title={t('settingsPanels.common.positions')}>
        <div className={styles.fieldGroup}>
          <Row setting="useLivePositions" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.safetyCar')}>
        <div className={styles.fieldGroup}>
          <Row setting="paceCarShowInPits" />
        </div>
      </Card>

      <Card group="display">
        <div className={styles.fieldGroup}>
          <Row setting="rowPadding" />
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={nameColumnLabels.title}
            desc={nameColumnLabels.desc}
          >
            <Slider
              style={{ width: NAME_COLUMN_SLIDER_WIDTH_PX }}
              min={nameColumnWidth.min}
              max={nameColumnWidth.max}
              step={nameColumnWidth.step}
              value={settings.nameColumnWidth}
              tooltip={{ formatter: (value) => `${value ?? 0} px` }}
              onChange={(value) => update({ nameColumnWidth: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="playerRowColor" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="playerAccentColor" />
        </div>
      </Card>
    </>
  );
});
