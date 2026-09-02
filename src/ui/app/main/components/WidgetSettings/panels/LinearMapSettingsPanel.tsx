import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented } from 'antd';
import {
  FlagZoneStyle,
  LinearMapOrientation,
  LinearMapWidgetSettings,
} from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['relative-map'];

const { ColorRow, SwitchRow } = panelRows<LinearMapWidgetSettings>();

export const LinearMapSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('relative-map');
  const { t } = useTranslation('widgets');

  const settings =
    widgetSettings.getSettings<LinearMapWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<LinearMapWidgetSettings>) => {
    widgetSettings.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.linearMap.moduleLayout')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.linearMap.orientation')}
          </span>
          <Segmented
            block
            value={settings.orientation}
            options={[
              {
                label: t('settingsPanels.linearMap.horizontal'),
                value: 'horizontal',
              },
              {
                label: t('settingsPanels.linearMap.vertical'),
                value: 'vertical',
              },
            ]}
            onChange={(v) => update({ orientation: v as LinearMapOrientation })}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.linearMap.playerMarker')}>
        <div className={styles.fieldGroup}>
          <ColorRow
            settingKey="playerDotColor"
            title={t('settingsPanels.linearMap.playerDotColor')}
            hex
          />

          <span className={styles.fieldLabel}>
            {t('settingsPanels.linearMap.dotRadius')}
          </span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="classShapes"
            title={t('settingsPanels.trackMap.classShapes')}
            desc={t('settingsPanels.trackMap.classShapesDesc')}
            fallback={false}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.linearMap.incidentZones')}>
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.linearMap.flagZoneStyle')}
          </span>
          <Segmented
            block
            value={settings.flagZoneStyle ?? 'filled'}
            options={[
              {
                label: t('settingsPanels.linearMap.flagZoneStyleFilled'),
                value: 'filled',
              },
              {
                label: t('settingsPanels.linearMap.flagZoneStyleOutline'),
                value: 'outline',
              },
            ]}
            onChange={(value) =>
              update({ flagZoneStyle: value as FlagZoneStyle })
            }
          />
          <span className={styles.fieldDesc}>
            {t('settingsPanels.linearMap.flagZoneStyleDesc')}
          </span>
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showIncidentZones"
            title={t('settingsPanels.linearMap.showIncidentZones')}
            desc={t('settingsPanels.linearMap.showIncidentZonesDesc')}
            fallback
          />
        </div>

        {(settings.showIncidentZones ?? true) && (
          <div className={styles.fieldGroup}>
            <SwitchRow
              settingKey="blinkIncidentZones"
              title={t('settingsPanels.linearMap.blinkIncidentZones')}
              fallback
            />
          </div>
        )}
      </Card>

      <Card title={t('settingsPanels.trackMap.safetyCar')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="paceCarUseClassColor"
            title={t('settingsPanels.trackMap.paceCarUseClassColor')}
            desc={t('settingsPanels.trackMap.paceCarUseClassColorDesc')}
            fallback={false}
          />
        </div>

        {!settings.paceCarUseClassColor && (
          <div className={styles.fieldGroup}>
            <ColorRow
              settingKey="paceCarColor"
              title={t('settingsPanels.trackMap.paceCarColor')}
              fallback={'#facc15'}
              hex
            />
          </div>
        )}

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>
            {t('settingsPanels.trackMap.paceCarRadius')}
          </span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.paceCarRadiusPx ?? settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ paceCarRadiusPx: v })}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="paceCarShowInPits"
            title={t('settingsPanels.trackMap.paceCarShowInPits')}
            desc={t('settingsPanels.trackMap.paceCarShowInPitsDesc')}
            fallback={false}
          />
        </div>
      </Card>
    </>
  );
});
