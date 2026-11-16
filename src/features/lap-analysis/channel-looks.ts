import type { LapChannel } from '@shared/contracts/generated/bindings';

/** The chart of time to the reference lap; not a channel of the file. */
export const DELTA_CHANNEL = 'deltaToReference';

/** The file's own time since the line, which the delta is counted from. */
export const ELAPSED_CHANNEL = 'ElapsedTime';

/** How a channel is drawn: values scaled to a unit people read. */
export interface ChannelLook {
  /** Multiplies the file's values. */
  scale: number;
  unit: string;
  digits: number;
  /** A plus sign before positive values. */
  signed: boolean;
}

const RAD_TO_DEG = 180 / Math.PI;
const MS_TO_KMH = 3.6;
const FRACTION_TO_PERCENT = 100;

const plain = (unit: string, digits: number): ChannelLook => ({
  scale: 1,
  unit,
  digits,
  signed: false,
});

/** Channels whose look the unit alone does not give. */
const KNOWN_LOOKS: Record<string, ChannelLook> = {
  [DELTA_CHANNEL]: { scale: 1, unit: 's', digits: 3, signed: true },
  Gear: plain('', 0),
  RPM: plain('rpm', 0),
};

/** The look a channel takes from its unit: km/h, %, degrees, or as written. */
export const channelLook = (name: string, unit: string): ChannelLook => {
  if (Object.hasOwn(KNOWN_LOOKS, name)) {
    return KNOWN_LOOKS[name];
  }

  if (unit === 'm/s') {
    return { scale: MS_TO_KMH, unit: 'km/h', digits: 0, signed: false };
  }

  if (unit === '%') {
    return { scale: FRACTION_TO_PERCENT, unit: '%', digits: 0, signed: false };
  }

  if (unit === 'rad') {
    return { scale: RAD_TO_DEG, unit: '°', digits: 0, signed: false };
  }

  if (unit === 'rad/s') {
    return { scale: RAD_TO_DEG, unit: '°/s', digits: 0, signed: false };
  }

  return plain(unit, 2);
};

/** "212 km/h", "+0.153 s". */
export const formatChannelValue = (look: ChannelLook, value: number) => {
  const sign = look.signed && value > 0 ? '+' : '';
  const unit = look.unit === '' ? '' : ` ${look.unit}`;

  return `${sign}${value.toFixed(look.digits)}${unit}`;
};

/** A lap's time at each point minus the reference's: positive is slower. */
export const deltaValues = (
  elapsed: Float32Array,
  reference: Float32Array
): Float32Array =>
  elapsed.map((time, index) => time - (reference[index] ?? time));

/** The catalog entry of a channel the charts show; the delta has its own. */
export const channelInfo = (
  name: string,
  catalog: LapChannel[]
): LapChannel | null =>
  name === DELTA_CHANNEL
    ? { name, unit: 's', description: '' }
    : (catalog.find((channel) => channel.name === name) ?? null);
