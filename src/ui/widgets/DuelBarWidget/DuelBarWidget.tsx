import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import {
  useDuelBarWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DuelBarWidgetSettings } from '@/types/widget-settings';
import { DuelAxis } from './DuelAxis';
import { DuelRow } from './DuelRow';

import styles from './DuelBarWidget.module.scss';

export const DuelBarWidget = observer(() => {
  const duelBar = useDuelBarWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<DuelBarWidgetSettings>('duel-bar');

  // Nobody in the threshold means nothing to fight over: the axis alone is
  // permanent noise on the screen, so the widget leaves entirely.
  if (!duelBar.isVisible) {
    return null;
  }

  return (
    <WidgetPanel className={styles.root} minWidth={200} gap={0}>
      <div className={styles.stage}>
        <DuelAxis />

        {!settings.compactMode &&
          duelBar.plateGroups.map((group) => (
            <DuelRow key={group.key} group={group} />
          ))}
      </div>
    </WidgetPanel>
  );
});
