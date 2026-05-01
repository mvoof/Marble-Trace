export interface NearbyCarInfo {
  carIdx: number;
  /** Meters ahead (+) or behind (-) */
  longitudinalDist: number;
  /** Lateral side based on CarLeftRight enum */
  lateralSide: 'left' | 'right' | 'center';
  /** Absolute longitudinal distance in meters */
  clearance: number;
}

export interface FrontRearDistances {
  /** Distance to closest car ahead (meters), Infinity if none */
  frontDist: number;
  /** Distance to closest car behind (meters), Infinity if none */
  rearDist: number;
}

export interface SpotterState {
  left: boolean;
  right: boolean;
}

export interface SideCarDistances {
  /** Longitudinal offset of closest car on the left (+ ahead, - behind), null if none */
  leftDist: number | null;
  /** Longitudinal offset of closest car on the right (+ ahead, - behind), null if none */
  rightDist: number | null;
}

export interface ComputedRadarDistances {
  /** Distance to closest car ahead (meters), Infinity if none */
  frontDist: number;
  /** Distance to closest car behind (meters), Infinity if none */
  rearDist: number;
  /** Distances for cars currently on the side according to the spotter */
  sideCars: SideCarDistances;
}
