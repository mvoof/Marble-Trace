export type DiagnosticsPhase =
  | 'idle'
  | 'countdown'
  | 'settling'
  | 'sampling'
  | 'done'
  | 'failed';

/**
 * What the in-game diagnostics banner shows. Sent from the main window, which
 * owns the run, to the small always-on-top window that is the only thing the
 * user can see while the sim has focus.
 */
export interface DiagnosticsHudState {
  phase: DiagnosticsPhase;
  secondsLeft: number;
  completedSteps: number;
  totalSteps: number;
  /** Filled once the run ends: the cost of the full widget set, in FPS. */
  summaryDeltaFps: number | null;
  error: string | null;
  /**
   * Carried in the payload rather than read from disk: the banner window lives
   * for one run and hydrating the whole settings file to learn one string would
   * cost more than the banner itself.
   */
  language: string;
}
