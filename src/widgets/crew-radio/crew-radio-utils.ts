import type { CrewRadioLine } from '@entities/crew-radio/crew-radio.store';
import type { CrewRadioWidgetSettings } from './settings-schema';

type LineSettings = Pick<
  CrewRadioWidgetSettings,
  'history' | 'recentCount' | 'hideDriverLines'
>;

/**
 * The lines one plate shows, oldest first. A press of push-to-talk takes a
 * slot of its own: in the current-only view it is the whole plate, since
 * what the driver is about to say replaces what was said before.
 */
export const visibleCrewRadioLines = (
  lines: readonly CrewRadioLine[],
  listening: boolean,
  settings: LineSettings
): CrewRadioLine[] => {
  const shown = settings.hideDriverLines
    ? lines.filter((line) => line.speaker !== 'driver')
    : lines;
  const slots = settings.history === 'recent' ? settings.recentCount : 1;
  const lineSlots = listening ? slots - 1 : slots;

  if (lineSlots <= 0) {
    return [];
  }

  return shown.slice(-lineSlots);
};
