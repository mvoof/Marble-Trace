export interface PlaceholderEntry {
  isPlaceholder: true;
  key: string;
}

export const isPlaceholder = (
  e: RelativeEntry | PlaceholderEntry
): e is PlaceholderEntry => 'isPlaceholder' in e;

export interface RelativeEntry {
  carIdx: number;
  userName: string;
  carNumber: string;
  carClassId: number;
  carClass: string;
  carClassShortName: string;
  carClassColor: string;
  position: number;
  lap: number;
  lapDistPct: number;
  f2Time: number;
  trackSurface: number;
  iRating: number;
  licString: string;
  isPlayer: boolean;
  onPitRoad: boolean;
}
