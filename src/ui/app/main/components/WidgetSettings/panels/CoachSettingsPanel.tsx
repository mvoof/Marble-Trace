import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented } from 'antd';

import type {
  CoachTraceChannel,
  CoachWidgetSettings,
} from '@/types/widget-settings';
import { Card } from './Card';

import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows, usePanelWidgetId } from './setting-rows';

const MIN_WINDOW_METERS = 50;
const MAX_WINDOW_METERS = 500;
const WINDOW_METERS_STEP = 25;
const DEFAULT_WINDOW_METERS = 150;

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['coach'];

const { ColorRow, DependentBlock, SwitchRow } =
  panelRows<CoachWidgetSettings>();

export const CoachSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('coach');
  const { t } = useTranslation('widgets');

  const settings = liveWidgets.getSettings<CoachWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<CoachWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title={t('settingsPanels.coach.call')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showCallRow"
            title={t('settingsPanels.coach.showCallRow')}
            desc={t('settingsPanels.coach.showCallRowDesc')}
          />
        </div>

        <SwitchRow
          settingKey="showUrgencyBar"
          dependsOn="showCallRow"
          title={t('settingsPanels.coach.urgencyBar')}
          desc={t('settingsPanels.coach.urgencyBarDesc')}
        />

        <SwitchRow
          settingKey="showCornerExitCalls"
          dependsOn="showCallRow"
          title={t('settingsPanels.coach.cornerExitCalls')}
          desc={t('settingsPanels.coach.cornerExitCallsDesc')}
        />

        <ColorRow
          settingKey="brakeColor"
          dependsOn="showCallRow"
          title={t('settingsPanels.coach.brakeAccent')}
          desc={t('settingsPanels.coach.brakeAccentDesc')}
          hex
        />

        <ColorRow
          settingKey="gasColor"
          dependsOn="showCallRow"
          title={t('settingsPanels.coach.gasAccent')}
          desc={t('settingsPanels.coach.gasAccentDesc')}
          hex
        />
      </Card>

      <Card title={t('settingsPanels.coach.readouts')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showSpeed"
            title={t('settingsPanels.coach.showSpeed')}
            desc={t('settingsPanels.coach.showSpeedDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showReferenceLapTime"
            title={t('settingsPanels.coach.showReferenceLapTime')}
            desc={t('settingsPanels.coach.showReferenceLapTimeDesc')}
          />
        </div>

        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showTrackCondition"
            title={t('settingsPanels.coach.showTrackCondition')}
            desc={t('settingsPanels.coach.showTrackConditionDesc')}
          />
        </div>
      </Card>

      <Card title={t('settingsPanels.coach.trace')}>
        <div className={styles.fieldGroup}>
          <SwitchRow
            settingKey="showTrace"
            title={t('settingsPanels.coach.showTrace')}
            desc={t('settingsPanels.coach.showTraceDesc')}
          />
        </div>

        <DependentBlock dependsOn="showTrace">
          <span className={styles.fieldLabel}>
            {t('settingsPanels.coach.channel')}
          </span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {t('settingsPanels.coach.channelDesc')}
          </div>
          <Segmented
            block
            value={settings.traceChannel}
            options={[
              {
                label: t('settingsPanels.coach.channelSpeed'),
                value: 'speed',
              },
              {
                label: t('settingsPanels.coach.channelBrake'),
                value: 'brake',
              },
            ]}
            onChange={(value) =>
              update({ traceChannel: value as CoachTraceChannel })
            }
          />
        </DependentBlock>

        <DependentBlock dependsOn="showTrace">
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
        </DependentBlock>

        <ColorRow
          settingKey="referenceColor"
          dependsOn="showTrace"
          title={t('settingsPanels.coach.referenceColor')}
          desc={t('settingsPanels.coach.referenceColorDesc')}
          hex
        />

        <ColorRow
          settingKey="gainColor"
          dependsOn="showTrace"
          title={t('settingsPanels.coach.gainColor')}
          desc={t('settingsPanels.coach.gainColorDesc')}
          hex
        />

        <ColorRow
          settingKey="lossColor"
          dependsOn="showTrace"
          title={t('settingsPanels.coach.lossColor')}
          desc={t('settingsPanels.coach.lossColorDesc')}
          hex
        />
      </Card>
    </>
  );
});
