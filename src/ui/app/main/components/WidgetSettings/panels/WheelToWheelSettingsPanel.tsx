import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented } from 'antd';

import type {
  WheelToWheelLayout,
  WheelToWheelWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

/** Seconds. Below a quarter nobody is ever inside; past three it is not a fight. */
const MIN_GAP_THRESHOLD = 0.25;
const MAX_GAP_THRESHOLD = 3;
const GAP_THRESHOLD_STEP = 0.25;

const MAX_HIDE_DELAY = 15;
const HIDE_DELAY_STEP = 0.5;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['wheel-to-wheel'];

const { SwitchRow } = panelRows<WheelToWheelWidgetSettings>();

export const WheelToWheelSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('wheel-to-wheel');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<WheelToWheelWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<WheelToWheelWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.wheelToWheel.display')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.wheelToWheel.layout')}
            desc={t('settingsPanels.wheelToWheel.layoutDesc')}
          >
            <Segmented<WheelToWheelLayout>
              value={settings.layout}
              onChange={(value) => update({ layout: value })}
              options={[
                {
                  label: t('settingsPanels.wheelToWheel.layoutColumns'),
                  value: 'columns',
                },
                {
                  label: t('settingsPanels.wheelToWheel.layoutRows'),
                  value: 'rows',
                },
              ]}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.wheelToWheel.appearsWhen')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.wheelToWheel.thresholdSeconds')}
            desc={t('settingsPanels.wheelToWheel.thresholdDesc')}
          >
            <InputNumber
              value={settings.gapThreshold}
              min={MIN_GAP_THRESHOLD}
              max={MAX_GAP_THRESHOLD}
              step={GAP_THRESHOLD_STEP}
              onChange={(value) => {
                if (value !== null) {
                  update({ gapThreshold: value });
                }
              }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.wheelToWheel.hideDelay')}
            desc={t('settingsPanels.wheelToWheel.hideDelayDesc')}
          >
            <InputNumber
              value={settings.hideDelay}
              min={0}
              max={MAX_HIDE_DELAY}
              step={HIDE_DELAY_STEP}
              onChange={(value) => {
                if (value !== null) {
                  update({ hideDelay: value });
                }
              }}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="raceOnly"
            title={t('settingsPanels.wheelToWheel.raceOnly')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="includeLapped"
            title={t('settingsPanels.wheelToWheel.includeLapped')}
            desc={t('settingsPanels.wheelToWheel.includeLappedDesc')}
          />
        </div>
      </Card>
    </>
  );
});
