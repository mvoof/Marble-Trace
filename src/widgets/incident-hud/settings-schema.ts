import {
  bool,
  choice,
  defineSettings,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const INCIDENT_HUD_SETTINGS = defineSettings('incidentHud', {
  /** The Safety Rating estimate and its change this session. */
  showProjectedSr: bool(true),
  /**
   * Penalties served and the incidents left before the next one. Hidden
   * anyway in a session that hands out none.
   */
  showPenalties: bool(true),
  /** Clean corners still needed for the session to come out level. */
  showCleanCorners: bool(true),
  /** What the chip beside the rating shows: the change so far, or the rating it leads to. */
  srChipMode: choice(['delta', 'projected'], 'delta'),
});

export type IncidentHudWidgetSettings = SettingsOf<
  typeof INCIDENT_HUD_SETTINGS.shape
>;
