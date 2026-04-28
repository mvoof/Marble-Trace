export interface CornerData {
  wearL: number;
  wearM: number;
  wearR: number;
  tempL: number;
  tempM: number;
  tempR: number;
  tempColorL: string;
  tempColorM: string;
  tempColorR: string;
  pressure: number;
  pressureUnit: string;
  rideHeight: number;
  shockDefl: number;
  brakeTemp: number;
  brakeTempColor: string;
  isPunctured: boolean;
  isBrakeOverheated: boolean;
}

export interface ChassisWidgetProps {
  lf: CornerData;
  rf: CornerData;
  lr: CornerData;
  rr: CornerData;
  tempUnit: string;
  lengthUnit: string;
  showInboard: boolean;
}
