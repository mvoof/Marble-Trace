import { observer } from 'mobx-react-lite';

import { useWidgetAutoHide } from '@hooks/common/useWidgetAutoHide';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import {
  useDrivingCoachWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DrivingCoachWidgetSettings } from '@/types/widget-settings';

import styles from './DrivingCoachWidget.module.scss';

const ADVISORY_LABEL = {
  brake: 'BRAKE',
  gas: 'GAS',
  neutral: '',
} as const;

export const DrivingCoachWidget = observer(() => {
  const coach = useDrivingCoachWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<DrivingCoachWidgetSettings>('driving-coach');

  const advisory = coach.displayedAdvisory;
  const hasContent = advisory !== 'neutral';

  useWidgetAutoHide(hasContent);

  if (!hasContent) {
    return null;
  }

  const accentColor =
    advisory === 'brake' ? settings.brakeColor : settings.gasColor;

  return (
    <WidgetPanel
      direction="column"
      gap={0}
      fitContent
      className={styles.panel}
      style={{ background: accentColor }}
    >
      <span className={styles.label}>{ADVISORY_LABEL[advisory]}</span>
    </WidgetPanel>
  );
});
