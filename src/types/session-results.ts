/**
 * ResultsPosition entry from iRacing session YAML.
 * Lives inside Sessions[n].ResultsPositions and updates live during the session.
 * Not exported by specta (pitwall marks it skip), so typed manually here.
 */
export type ResultsPosition = {
  CarIdx: number;
  Position: number;
  ClassPosition: number;
  Lap: number | null;
  LapsComplete: number | null;
  LapsDriven: number | null;
  FastestLap: number | null;
  FastestTime: number | null;
  LastTime: number | null;
  LapsLed: number | null;
  Incidents: number | null;
  ReasonOutId: number | null;
  ReasonOutStr: string | null;
  Time: number | null;
};

/** Session type extended with typed ResultsPositions */
import type { Session } from './bindings';

export type SessionWithResults = Omit<Session, 'ResultsPositions'> & {
  ResultsPositions?: ResultsPosition[] | null;
};
