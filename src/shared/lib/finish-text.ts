import type { RecentSession } from '@shared/contracts/generated/bindings';

/** "P14 / 48", "P6" with the field unknown; `null` without a finish. */
export const finishText = (
  session: Pick<RecentSession, 'finishPos' | 'fieldSize'>
): string | null => {
  if (session.finishPos === null) {
    return null;
  }

  const field = session.fieldSize === null ? '' : ` / ${session.fieldSize}`;

  return `P${session.finishPos}${field}`;
};
