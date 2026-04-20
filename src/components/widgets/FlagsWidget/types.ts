export type FlagType =
  | 'none'
  | 'green'
  | 'yellow'
  | 'red'
  | 'blue'
  | 'white'
  | 'checkered'
  | 'black'
  | 'meatball'
  | 'debris';

export type FlagsVariant = 'overlay' | 'under-mirror' | 'standalone';

export interface FlagsWidgetSettings {
  variant: FlagsVariant;
  cutoutWidth: number;
  cutoutHeight: number;
}
