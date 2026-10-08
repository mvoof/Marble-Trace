import type { TFunction } from 'i18next';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider } from 'antd';
import type { LapDeltaReference } from '@shared/contracts/widget-choices';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import {
  panelRows,
  usePanelWidgetId,
} from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { DELTA_SETTINGS, type DeltaWidgetSettings } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['delta'];

const { DependentBlock } = panelRows<DeltaWidgetSettings>();
const { Row } = schemaRows(DELTA_SETTINGS);
const { flashDuration } = DELTA_SETTINGS.shape;

const referenceDescOf = (t: TFunction): Record<LapDeltaReference, string> => ({
  personal_best: t('settingsPanels.delta.referenceDesc.personalBest'),
  personal_optimal: t('settingsPanels.delta.referenceDesc.personalOptimal'),
  session_best: t('settingsPanels.delta.referenceDesc.sessionBest'),
  session_optimal: t('settingsPanels.delta.referenceDesc.sessionOptimal'),
  session_last: t('settingsPanels.delta.referenceDesc.sessionLast'),
});

export const DeltaSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('delta');
  const { t } = useTranslation('widgets');
  const settings = liveWidgets.getSettings<DeltaWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<DeltaWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
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
            {referenceDescOf(t)[settings.reference]}
          </div>
        </div>
      </Card>

      <Card title={t('settingsPanels.delta.visibility')}>
        <Row setting="hideWhenNoReference" />
        <Row setting="showGauge" />
      </Card>

      <Card title={t('settingsPanels.delta.lapCompletedCard')}>
        <Row setting="showLapFlash" />

        <DependentBlock dependsOn="showLapFlash">
          <div className={styles.fieldLabel}>
            {t('settingsPanels.delta.flashDuration', {
              seconds: settings.flashDuration,
            })}
          </div>
          <Slider
            min={flashDuration.min}
            max={flashDuration.max}
            step={1}
            value={settings.flashDuration}
            onChange={(value) => update({ flashDuration: value })}
          />
        </DependentBlock>
      </Card>
    </>
  );
});
