/**
 * iRacing Track Surface types (irsdk_TrkLoc enum)
 */
export enum TrackSurface {
  NotInWorld = 'NotInWorld',
  OffTrack = 'OffTrack',
  InPitStall = 'InPitStall',
  AproachingPits = 'AproachingPits',
  OnTrack = 'OnTrack',
}

/**
 * iRacing Session State (irsdk_SessionState enum)
 */
export enum SessionState {
  Invalid = 'Invalid',
  GetInCar = 'GetInCar',
  Warmup = 'Warmup',
  ParadeLaps = 'ParadeLaps',
  Racing = 'Racing',
  Checkered = 'Checkered',
  CoolDown = 'CoolDown',
}

/**
 * iRacing Skies conditions
 */
export enum Skies {
  Clear = 'Clear',
  PartlyCloudy = 'PartlyCloudy',
  MostlyCloudy = 'MostlyCloudy',
  Overcast = 'Overcast',
}
