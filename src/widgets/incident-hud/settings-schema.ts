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
  /** `finish` counts the corners left as driven clean; `current` stops at the car. */
  projectionMode: choice(['finish', 'current'], 'finish'),
});

export type IncidentHudWidgetSettings = SettingsOf<
  typeof INCIDENT_HUD_SETTINGS.shape
>;
