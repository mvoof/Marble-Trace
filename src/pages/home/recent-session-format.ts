import type { RecentSession } from '@shared/contracts/generated/bindings';

/** The sim's event types the table names; any other shows as it is. */
const NAMED_EVENT_TYPES = {
  Practice: 'practice',
  Test: 'test',
} as const;

export type NamedEventType =
  (typeof NAMED_EVENT_TYPES)[keyof typeof NAMED_EVENT_TYPES];

export type FinishLabel =
  | { kind: 'place'; text: string }
  | { kind: 'event'; eventType: NamedEventType }
  | { kind: 'raw'; text: string }
  | { kind: 'none' };

const isNamedEventType = (
  eventType: string
): eventType is keyof typeof NAMED_EVENT_TYPES =>
  Object.hasOwn(NAMED_EVENT_TYPES, eventType);

/**
 * The finish column: the place in a race seen to the flag, the kind of
 * session where nothing was raced, a dash for a race left before the flag.
 */
export const finishLabel = (
  session: Pick<RecentSession, 'eventType' | 'finishPos' | 'fieldSize'>
): FinishLabel => {
  if (session.finishPos !== null) {
    const field = session.fieldSize === null ? '' : ` / ${session.fieldSize}`;

    return { kind: 'place', text: `P${session.finishPos}${field}` };
  }

  if (isNamedEventType(session.eventType)) {
    return { kind: 'event', eventType: NAMED_EVENT_TYPES[session.eventType] };
  }

  if (session.eventType === 'Race' || session.eventType === '') {
    return { kind: 'none' };
  }

  return { kind: 'raw', text: session.eventType };
};
