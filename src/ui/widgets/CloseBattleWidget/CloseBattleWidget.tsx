import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import {
  useCloseBattleWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';
import { BattleAxis } from './BattleAxis';
import { BattleRow } from './BattleRow';

import styles from './CloseBattleWidget.module.scss';

export const CloseBattleWidget = observer(() => {
  const closeBattle = useCloseBattleWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<CloseBattleWidgetSettings>('close-battle');

  // Nobody in the threshold means nothing to fight over: the axis alone is
  // permanent noise on the screen, so the widget leaves entirely.
  if (!closeBattle.isVisible) {
    return null;
  }

  return (
    <WidgetPanel className={styles.root} minWidth={200} gap={0}>
      <div className={styles.stage}>
        <BattleAxis />

        {!settings.compactMode &&
          closeBattle.plateGroups.map((group) => (
            <BattleRow key={group.key} group={group} />
          ))}
      </div>
    </WidgetPanel>
  );
});
