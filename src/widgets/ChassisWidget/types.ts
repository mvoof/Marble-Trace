export type CornerPosition = 'lf' | 'rf' | 'lr' | 'rr';

export interface CornerData {
  wearL: number | null;
  wearM: number | null;
  wearR: number | null;
  tempL: number | null;
  tempM: number | null;
  tempR: number | null;
  tempColorL: string;
  tempColorM: string;
  tempColorR: string;
  pressure: number | null;
  pressureUnit: string;
  rideHeight: number | null;
  shockDefl: number | null;
  brakeTemp: number | null;
  brakeTempColor: string;
  isPunctured: boolean;
  isBrakeOverheated: boolean;
}
