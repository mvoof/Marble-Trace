import type { WidgetMount } from '@ui/widgets/widget-mount';
import { CLOSE_BATTLE_MANIFEST } from './manifest';
import { CloseBattleWidget } from './CloseBattleWidget';

export const mount: WidgetMount = {
  id: CLOSE_BATTLE_MANIFEST.id,
  component: CloseBattleWidget,
};
