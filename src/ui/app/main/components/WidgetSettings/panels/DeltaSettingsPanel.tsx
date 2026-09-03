import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider, Switch } from 'antd';
import type {
  LapDeltaReference,
  DeltaWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { getDeltaReferenceDesc } from './shared';
import { useWidgetEditor } from '../WidgetEditorContext';
import { usePanelWidgetId } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['delta'];

export const DeltaSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('delta');
  const { t } = useTranslation('widgets');
  const settings =
    widgetSettings.getSettings<DeltaWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<DeltaWidgetSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.delta.deltaReference')}>
        <div className={styles.fieldGroup}>
          <Segmented
            block
            value={settings.reference}
            options={[
              { label: 'PB', value: 'personal_best' },
              { label: 'PO', value: 'personal_optimal' },
              { label: 'SB', value: 'session_best' },
              { label: 'SO', value: 'session_optimal' },
              { label: 'SL', value: 'session_last' },
            ]}
            onChange={(value) =>
              update({ reference: value as LapDeltaReference })
            }
          />
          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            {getDeltaReferenceDesc(t)[settings.reference]}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.delta.visibility')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.delta.hideWhenNoReference')}
            </span>
            <Switch
              checked={settings.hideWhenNoReference}
              onChange={(value) => update({ hideWhenNoReference: value })}
            />
          </div>

          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.delta.showGauge')}
            </span>
            <Switch
              checked={settings.showGauge}
              onChange={(value) => update({ showGauge: value })}
            />
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.delta.lapCompletedCard')}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>
              {t('settingsPanels.delta.showAfterLap')}
            </span>
            <Switch
              checked={settings.showLapFlash}
              onChange={(value) => update({ showLapFlash: value })}
            />
          </div>
        </div>

        {settings.showLapFlash && (
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              {t('settingsPanels.delta.displayDuration', {
                seconds: settings.flashDuration,
              })}
            </div>
            <Slider
              min={3}
              max={10}
              step={1}
              value={settings.flashDuration}
              onChange={(value) => update({ flashDuration: value })}
            />
          </div>
        )}
      </Card>
    </>
  );
});
