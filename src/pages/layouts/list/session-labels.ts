import type { SessionContext } from '@shared/contracts/widget-settings';

/** The sessions a layout can be assigned to, in the order the list shows them. */
export const SESSION_CONTEXTS: SessionContext[] = [
  'Practice',
  'Qualify',
  'Race',
  'Garage',
];

export const SESSION_LABEL_KEYS: Record<SessionContext, string> = {
  Practice: 'layoutList.sessions.practice',
  Qualify: 'layoutList.sessions.qualify',
  Race: 'layoutList.sessions.race',
  Garage: 'layoutList.sessions.garage',
};
