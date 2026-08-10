import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ColorPicker, InputNumber, Switch } from 'antd';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import { Card } from './Card';
import { SettingRow } from './SettingRow';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetEditor } from '../WidgetEditorContext';

const MIN_WINDOW_METERS = 50;
const MAX_WINDOW_METERS = 500;
const WINDOW_METERS_STEP = 25;
const DEFAULT_WINDOW_METERS = 150;

export const CoachSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

  const update = (partial: Partial<CoachWidgetSettings>) => {
    widgetSettings.updateUserSettings('coach', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.coach.call')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.coach.urgencyBar')}
            desc={t('settingsPanels.coach.urgencyBarDesc')}
          >
            <Switch
              checked={settings.showUrgencyBar}
              onChange={(value) => update({ showUrgencyBar: value })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.coach.brakeAccent')}
            desc={t('settingsPanels.coach.brakeAccentDesc')}
          >
            <ColorPicker
              value={settings.brakeColor}
              onChange={(color) => update({ brakeColor: color.toHexString() })}
            />
          </SettingRow>
        </div>

        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.coach.gasAccent')}
            desc={t('settingsPanels.coach.gasAccentDesc')}
          >
            <ColorPicker
              value={settings.gasColor}
              onChange={(color) => update({ gasColor: color.toHexString() })}
            />
          </SettingRow>
        </div>
      </Card>

      <Card title={t('settingsPanels.coach.trace')}>
        <div className={styles.fieldGroup}>
          <SettingRow
            title={t('settingsPanels.coach.showTrace')}
            desc={t('settingsPanels.coach.showTraceDesc')}
          >
            <Switch
              checked={settings.showTrace}
              onChange={(value) => update({ showTrace: value })}
            />
          </SettingRow>
        </div>

        {settings.showTrace && (
          <>
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.coach.window')}
              </span>
              <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
                {t('settingsPanels.coach.windowDesc')}
              </div>
              <InputNumber
                style={{ width: '100%' }}
                value={settings.windowMeters}
                min={MIN_WINDOW_METERS}
                max={MAX_WINDOW_METERS}
                step={WINDOW_METERS_STEP}
                onChange={(value) =>
                  update({ windowMeters: value ?? DEFAULT_WINDOW_METERS })
                }
              />
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.coach.referenceColor')}
                desc={t('settingsPanels.coach.referenceColorDesc')}
              >
                <ColorPicker
                  value={settings.referenceColor}
                  onChange={(color) =>
                    update({ referenceColor: color.toHexString() })
                  }
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.coach.gainColor')}
                desc={t('settingsPanels.coach.gainColorDesc')}
              >
                <ColorPicker
                  value={settings.gainColor}
                  onChange={(color) =>
                    update({ gainColor: color.toHexString() })
                  }
                />
              </SettingRow>
            </div>

            <div className={styles.fieldGroup}>
              <SettingRow
                title={t('settingsPanels.coach.lossColor')}
                desc={t('settingsPanels.coach.lossColorDesc')}
              >
                <ColorPicker
                  value={settings.lossColor}
                  onChange={(color) =>
                    update({ lossColor: color.toHexString() })
                  }
                />
              </SettingRow>
            </div>
          </>
        )}
      </Card>
    </>
  );
});
