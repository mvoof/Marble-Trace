/**
 * iRacing Track Surface types (irsdk_TrkLoc enum)
 */
export enum TrackSurface {
  NotInWorld = -1,
  OffTrack = 0,
  InPitStall = 1,
  AproachingPits = 2,
  OnTrack = 3,
}

/**
 * iRacing Session State (irsdk_SessionState enum)
 */
export enum SessionState {
  Invalid = 0,
  GetInCar = 1,
  Warmup = 2,
  ParadeLaps = 3,
  Racing = 4,
  Checkered = 5,
  CoolDown = 6,
}

/**
 * iRacing Skies conditions
 */
export enum Skies {
  Clear = 0,
  PartlyCloudy = 1,
  MostlyCloudy = 2,
  Overcast = 3,
}
