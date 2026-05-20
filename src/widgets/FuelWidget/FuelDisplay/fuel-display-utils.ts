import { FUEL_THRESHOLDS } from '@utils/constants/fuel-constants';

import styles from './FuelDisplay.module.scss';

export const statusClass = (
  shortage: number | null,
  lapsRemaining: number | null,
  pitWarningLaps: number
): string => {
  if (shortage === null || lapsRemaining === null) {
    return '';
  }

  if (lapsRemaining <= pitWarningLaps) {
    return styles.finishDanger;
  }

  if (shortage >= 0) {
    return styles.finishSafe;
  }

  return '';
};

export const shortageClass = (shortage: number | null): string => {
  if (shortage === null) {
    return '';
  }

  return shortage >= 0 ? styles.valueSafe : '';
};

export const lapsRemainingClass = (
  lapsRemaining: number | null,
  pitWarningLaps: number
): string => {
  if (lapsRemaining === null) {
    return '';
  }

  if (lapsRemaining > pitWarningLaps + FUEL_THRESHOLDS.LAPS_LEFT_GREEN_BUFFER) {
    return styles.valueSafe;
  }

  if (lapsRemaining <= pitWarningLaps) {
    return styles.valueDanger;
  }

  return styles.valueWarning;
};
