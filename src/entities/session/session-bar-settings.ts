import {
  LAP_COUNTER,
  STAT_CHIP_PRESENTATIONS,
} from '@shared/contracts/widget-choices';
import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

const CHIP_LABEL_MODE = choice(['text', 'icon'], 'text', {
  label: 'common.chipLabelMode',
});

export const SESSION_BAR_SETTINGS = defineSettings('common', {
  showSessionType: bool(true, { label: 'common.showSessionType' }),
  showTotalDrivers: bool(true, { label: 'common.showTotalDrivers' }),
  showSOF: bool(true, { label: 'common.showSOF' }),
  abbreviateSof: bool(true, { label: 'common.abbreviateSof' }),
  showLapProgress: bool(true, { label: 'common.showLapProgress' }),
  lapCounter: choice(LAP_COUNTER, 'session', { label: 'common.lapCounter' }),
  showSessionTime: bool(true, { label: 'common.showSessionTime' }),
  headerChipStyle: choice(STAT_CHIP_PRESENTATIONS, 'semantic', {
    label: 'common.barChipStyle',
  }),
  headerChipLabelMode: CHIP_LABEL_MODE,
  footerChipStyle: choice(STAT_CHIP_PRESENTATIONS, 'semantic', {
    label: 'common.barChipStyle',
  }),
  footerChipLabelMode: CHIP_LABEL_MODE,
  showAirTemp: bool(true, { label: 'common.showAirTemp' }),
  showTrackTemp: bool(true, { label: 'common.showTrackTemp' }),
  showTrackWetness: bool(true, { label: 'common.showTrackWetness' }),
  showPenalties: bool(true, { label: 'common.showPenalties' }),
  showPitStops: bool(true, { label: 'common.showPitStops' }),
  showIncidentsBadge: bool(true, { label: 'common.showIncidentsBadge' }),
});

export type SessionBarSettings = SettingsOf<typeof SESSION_BAR_SETTINGS.shape>;
