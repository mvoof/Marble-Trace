import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Slider } from 'antd';
import { FlagDisplaySettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { widgetTypeOf } from '@utils/widget-instance';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['led-flags', 'flat-flags'];

const { DependentBlock, SwitchRow } = panelRows<FlagDisplaySettings>();

// A flag held on screen for good has no hold time to set.
const isHoldShown = (settings: FlagDisplaySettings): boolean =>
  !settings.alwaysShow;

export const FlagDisplaySettingsPanel = observer(
  ({ widgetId }: { widgetId: string }) => {
    const liveWidgets = useWidgetEditor();
    const { t } = useTranslation('widgets');
    const widgetType = widgetTypeOf(
      liveWidgets.getWidget(widgetId) ?? { id: widgetId }
    );
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
          <SwitchRow
            settingKey="alwaysShow"
            title={t('settingsPanels.flagDisplay.alwaysShow')}
            desc={t('settingsPanels.flagDisplay.alwaysShowDesc')}
          />
        </div>

        <DependentBlock dependsOn={isHoldShown}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.flagDisplay.holdDuration', {
              seconds: settings.holdDuration,
            })}
          </span>
          <div className={styles.fieldDesc}>
            {t('settingsPanels.flagDisplay.holdDurationDesc')}
          </div>
          <Slider
            min={0}
            max={30}
            step={1}
            value={settings.holdDuration}
            onChange={(v) => update({ holdDuration: v })}
          />
        </DependentBlock>

        {widgetType === 'led-flags' && (
          <>
            <div className={styles.fieldGroup}>
              <SwitchRow
                settingKey="forceSingleLed"
                title={t('settingsPanels.flagDisplay.forceSingleLed')}
                desc={t('settingsPanels.flagDisplay.forceSingleLedDesc')}
                fallback={false}
              />
            </div>

            <div className={styles.fieldGroup}>
              <SwitchRow
                settingKey="split"
                title={t('settingsPanels.flagDisplay.splitDisplay')}
                desc={t('settingsPanels.flagDisplay.splitDisplayDesc')}
                fallback={false}
              />
            </div>

            <div className={styles.fieldGroup}>
              <SwitchRow
                settingKey="animate"
                title={t('settingsPanels.flagDisplay.animateLeds')}
                desc={t('settingsPanels.flagDisplay.animateLedsDesc')}
                fallback
              />
            </div>
          </>
        )}
      </Card>
    );
  }
);
