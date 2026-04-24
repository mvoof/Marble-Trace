import type { DriverEntry } from './bindings';

export type SeparatorEntry = {
  isSeparator: true;
  id: string;
};

export type DriverGroup = {
  classId: number;
  className: string;
  classShortName: string;
  classColor: string;
  totalDrivers: number;
  classSof: number;
  drivers: (DriverEntry | SeparatorEntry)[];
};
