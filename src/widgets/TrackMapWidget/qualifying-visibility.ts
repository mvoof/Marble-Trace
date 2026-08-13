import type { RadarQualifyingVisibility } from '@/types/widget-settings';

interface QualifyingState {
  isQualifyingSession: boolean;
  isLoneQualifying: boolean;
}

/**
 * Shared rule behind the "show in qualifying" setting: `never` blanks every
 * qualifying session, `auto` only the solo ones where nobody else is on track.
 */
export const isHiddenInQualifying = (
  visibility: RadarQualifyingVisibility | undefined,
  session: QualifyingState
): boolean => {
  if (visibility === 'never') {
    return session.isQualifyingSession;
  }

  if (visibility === 'auto') {
    return session.isLoneQualifying;
  }

  return false;
};
