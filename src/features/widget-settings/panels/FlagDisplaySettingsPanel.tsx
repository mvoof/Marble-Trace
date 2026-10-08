import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '../Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows } from '../setting-rows';
import { schemaRows } from '../schema-rows';
import {
  LED_FLAGS_SETTINGS,
  type FlagDisplaySettings,
} from '@entities/flags/flag-display.settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['led-flags', 'flat-flags'];

const { DependentBlock } = panelRows<FlagDisplaySettings>();
// The LED schema holds the flat one's settings too, under the same labels.
const { Row, useLabels } = schemaRows(LED_FLAGS_SETTINGS);
const { holdDuration } = LED_FLAGS_SETTINGS.shape;

// A flag held on screen for good has no hold time to set.
const isHoldShown = (settings: FlagDisplaySettings): boolean =>
  !settings.alwaysShow;

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: string }) => {
    const liveWidgets = useWidgetEditor();
    const { t } = useTranslation('widgets');
    const holdLabels = useLabels('holdDuration');
    const widgetType = liveWidgets.getWidget(widgetId)?.type ?? widgetId;
    const settings = liveWidgets.getSettings<FlagDisplaySettings>(widgetId);

    const update = (partial: Partial<FlagDisplaySettings>) => {
      liveWidgets.updateUserSettings(widgetId, {
        ...settings,
        ...partial,
      });
    };

    return (
      <Card title={t('settingsPanels.flagDisplay.displayMode')}>
        <div className={styles.fieldGroup}>
          <Row setting="alwaysShow" />
        </div>

        <DependentBlock dependsOn={isHoldShown}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.flagDisplay.holdDuration', {
              seconds: settings.holdDuration,
            })}
          </span>
          <div className={styles.fieldDesc}>{holdLabels.desc}</div>
          <Slider
            min={holdDuration.min}
            max={holdDuration.max}
            step={holdDuration.step}
            value={settings.holdDuration}
            onChange={(v) => update({ holdDuration: v })}
          />
        </DependentBlock>

        {widgetType === 'led-flags' && (
          <>
            <div className={styles.fieldGroup}>
              <Row setting="forceSingleLed" />
            </div>

            <div className={styles.fieldGroup}>
              <Row setting="split" />
            </div>

            <div className={styles.fieldGroup}>
              <Row setting="animate" />
            </div>
          </>
        )}
      </Card>
    );
  }
);
