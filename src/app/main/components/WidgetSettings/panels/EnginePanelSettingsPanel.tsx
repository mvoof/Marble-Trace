import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch, Segmented } from 'antd';
import { EnginePanelWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const EnginePanelSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<EnginePanelWidgetSettings>('engine-panel');

  const update = (partial: Partial<EnginePanelWidgetSettings>) => {
    widgetSettings.updateUserSettings('engine-panel', {
      ...settings,
      ...partial,
    });
  };

  const toggles: {
    titleKey: string;
    descKey: string;
    value: boolean;
    key: keyof EnginePanelWidgetSettings;
  }[] = [
    {
      titleKey: 'settingsPanels.enginePanel.oilTemperature',
      descKey: 'settingsPanels.enginePanel.oilTemperatureDesc',
      value: settings.showOilTemp,
      key: 'showOilTemp',
    },
    {
      titleKey: 'settingsPanels.enginePanel.waterTemperature',
      descKey: 'settingsPanels.enginePanel.waterTemperatureDesc',
      value: settings.showWaterTemp,
      key: 'showWaterTemp',
    },
    {
      titleKey: 'settingsPanels.enginePanel.oilPressure',
      descKey: 'settingsPanels.enginePanel.oilPressureDesc',
      value: settings.showOilPress,
      key: 'showOilPress',
    },
    {
      titleKey: 'settingsPanels.enginePanel.systemVoltage',
      descKey: 'settingsPanels.enginePanel.systemVoltageDesc',
      value: settings.showVoltage,
      key: 'showVoltage',
    },
    {
      titleKey: 'settingsPanels.enginePanel.absLevel',
      descKey: 'settingsPanels.enginePanel.absLevelDesc',
      value: settings.showAbs,
      key: 'showAbs',
    },
    {
      titleKey: 'settingsPanels.enginePanel.tractionControl',
      descKey: 'settingsPanels.enginePanel.tractionControlDesc',
      value: settings.showTc,
      key: 'showTc',
    },
    {
      titleKey: 'settingsPanels.enginePanel.brakeBias',
      descKey: 'settingsPanels.enginePanel.brakeBiasDesc',
      value: settings.showBrakeBias,
      key: 'showBrakeBias',
    },
    {
      titleKey: 'settingsPanels.enginePanel.engineMap',
      descKey: 'settingsPanels.enginePanel.engineMapDesc',
      value: settings.showEngineMap,
      key: 'showEngineMap',
    },
  ];

  return (
    <Card title={t('settingsPanels.enginePanel.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <SettingRow
          title={t('settingsPanels.enginePanel.horizontalLayout')}
          desc={t('settingsPanels.enginePanel.horizontalLayoutDesc')}
        >
          <Switch
            checked={settings.horizontal}
            onChange={(v) => update({ horizontal: v })}
          />
        </SettingRow>
      </div>

      {settings.horizontal ? (
        <div className={styles.fieldGroup}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
            }}
          >
            <div>
              <div className={styles.fieldTitle}>
                {t('settingsPanels.enginePanel.horizontalColumns')}
              </div>
              <div className={styles.fieldDesc}>
                {t('settingsPanels.enginePanel.horizontalColumnsDesc')}
              </div>
            </div>
            <Segmented
              block
              value={settings.horizontalColumns ?? 8}
              options={[
                {
                  label: t('settingsPanels.enginePanel.cols3'),
                  value: 3,
                },
                {
                  label: t('settingsPanels.enginePanel.cols4'),
                  value: 4,
                },
                {
                  label: t('settingsPanels.enginePanel.maxRow'),
                  value: 8,
                },
              ]}
              onChange={(value) =>
                update({ horizontalColumns: value as number })
              }
            />
          </div>
        </div>
      ) : (
        <div className={styles.fieldGroup}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
            }}
          >
            <div>
              <div className={styles.fieldTitle}>
                {t('settingsPanels.enginePanel.verticalColumns')}
              </div>
              <div className={styles.fieldDesc}>
                {t('settingsPanels.enginePanel.verticalColumnsDesc')}
              </div>
            </div>
            <Segmented
              block
              value={settings.verticalColumns ?? 2}
              options={[
                { label: t('settingsPanels.enginePanel.cols1'), value: 1 },
                { label: t('settingsPanels.enginePanel.cols2'), value: 2 },
                { label: t('settingsPanels.enginePanel.cols3'), value: 3 },
                { label: t('settingsPanels.enginePanel.cols4'), value: 4 },
              ]}
              onChange={(value) => update({ verticalColumns: value as number })}
            />
          </div>
        </div>
      )}

      {toggles.map((item) => (
        <div key={item.key} className={styles.fieldGroup}>
          <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
            <Switch
              checked={item.value}
              onChange={(v) => update({ [item.key]: v })}
            />
          </SettingRow>
        </div>
      ))}
    </Card>
  );
});
