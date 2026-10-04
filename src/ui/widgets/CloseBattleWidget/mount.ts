import type { WidgetMount } from '@ui/widgets/widget-mount';
import { CLOSE_BATTLE_MANIFEST } from './manifest';
import { CloseBattleWidget } from './CloseBattleWidget';
import { CloseBattleWidgetStore } from './close-battle.widget';

export const mount: WidgetMount = {
  id: CLOSE_BATTLE_MANIFEST.id,
  component: CloseBattleWidget,
  store: (context) => new CloseBattleWidgetStore(context),
};
