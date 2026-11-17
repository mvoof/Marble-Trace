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

/** A session's chip colour, one of the design guide's tones. */
export type SessionTone = 'info' | 'positive' | 'special' | 'accent';

export const SESSION_LOOKS: Record<
  SessionContext,
  { labelKey: string; icon: LucideIcon; tone: SessionTone }
> = {
  Garage: {
    labelKey: 'layoutList.sessions.garage',
    icon: Warehouse,
    tone: 'info',
  },
  Practice: {
    labelKey: 'layoutList.sessions.practice',
    icon: Route,
    tone: 'positive',
  },
  Qualify: {
    labelKey: 'layoutList.sessions.qualify',
    icon: Timer,
    tone: 'special',
  },
  Race: { labelKey: 'layoutList.sessions.race', icon: Flag, tone: 'accent' },
};
