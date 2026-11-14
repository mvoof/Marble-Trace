import type { LucideIcon } from 'lucide-react';
import { Flag, Route, Timer, Warehouse } from 'lucide-react';

import type { SessionContext } from '@shared/contracts/widget-settings';

/** The sessions a layout can be assigned to, in the order a weekend runs. */
export const SESSION_CONTEXTS: SessionContext[] = [
  'Garage',
  'Practice',
  'Qualify',
  'Race',
];

export const SESSION_LOOKS: Record<
  SessionContext,
  { labelKey: string; icon: LucideIcon }
> = {
  Garage: { labelKey: 'layoutList.sessions.garage', icon: Warehouse },
  Practice: { labelKey: 'layoutList.sessions.practice', icon: Route },
  Qualify: { labelKey: 'layoutList.sessions.qualify', icon: Timer },
  Race: { labelKey: 'layoutList.sessions.race', icon: Flag },
};
