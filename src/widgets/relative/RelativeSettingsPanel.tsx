import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { SettingRow } from '@features/widget-settings/SettingRow';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  RELATIVE_SETTINGS,
  type RelativeWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['relative'];

const { Row, useLabels } = schemaRows(RELATIVE_SETTINGS);
const { nameColumnWidth } = RELATIVE_SETTINGS.shape;

const NAME_COLUMN_SLIDER_WIDTH_PX = 160;

export const RelativeSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('relative');
  const { t } = useTranslation('widgets');
  const nameColumnLabels = useLabels('nameColumnWidth');

  const settings =
    liveWidgets.getSettings<RelativeWidgetSettings>(panelWidgetId);

  return (
    <>
      <Card title={t('settingsPanels.relative.appearance')}>
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
              onChange={(value) =>
                liveWidgets.updateUserSettings(panelWidgetId, {
                  nameColumnWidth: value,
                })
              }
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

      <Card title={t('settingsPanels.common.positions')}>
        <div className={styles.fieldGroup}>
          <Row setting="useLivePositions" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.dataColumns')}>
        <Row setting="showCarNumber" />
        <Row setting="showLicBadge" />
        <Row setting="licBadgeStyle" dependsOn="showLicBadge" />
        <Row setting="showLicenseLetter" dependsOn="showLicBadge" />
        <Row setting="showIRating" />
        <Row setting="abbreviateIRating" dependsOn="showIRating" />
        <Row setting="showPitIndicator" />
        <Row setting="abbreviateNames" />
        <Row setting="showCountryFlag" />
        <Row setting="showDriverFlags" />
      </Card>

      <Card title={t('settingsPanels.common.safetyCar')}>
        <div className={styles.fieldGroup}>
          <Row setting="paceCarShowInPits" />
        </div>
      </Card>

      <Card title={t('settingsPanels.common.qualifying')}>
        <div className={styles.fieldGroup}>
          <Row setting="qualifyingVisibility" />
        </div>
      </Card>
    </>
  );
});
