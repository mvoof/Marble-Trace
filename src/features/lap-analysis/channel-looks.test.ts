import { describe, expect, it } from 'vitest';

import {
  DELTA_CHANNEL,
  channelLook,
  deltaValues,
  formatChannelValue,
} from './channel-looks';

describe('channelLook', () => {
  it('scales speed to km/h, pedals to %, angles to degrees', () => {
    expect(formatChannelValue(channelLook('Speed', 'm/s'), 180)).toBe(
      '180 km/h'
    );
    expect(formatChannelValue(channelLook('Throttle', '%'), 50)).toBe('50 %');
    expect(channelLook('SteeringWheelAngle', 'rad').scale).toBeCloseTo(57.2958);
  });

  it('signs the delta and leaves the gear bare', () => {
    expect(formatChannelValue(channelLook(DELTA_CHANNEL, 's'), 0.1534)).toBe(
      '+0.153 s'
    );
    expect(formatChannelValue(channelLook(DELTA_CHANNEL, 's'), -0.2)).toBe(
      '-0.200 s'
    );
    expect(formatChannelValue(channelLook('Gear', ''), 4)).toBe('4');
  });

  it('shows suspension travel in mm, not as a speed', () => {
    const rideHeight = channelLook('LFrideHeight', 'm');
    const shockSpeed = channelLook('RRshockVel', 'm/s');

    expect(formatChannelValue(rideHeight, 0.0523 * rideHeight.scale)).toBe(
      '52.3 mm'
    );
    expect(formatChannelValue(shockSpeed, 0.12 * shockSpeed.scale)).toBe(
      '120 mm/s'
    );
    expect(formatChannelValue(channelLook('dcABS', ''), 3)).toBe('3');
  });
});

describe('deltaValues', () => {
  it('is the lap’s time at each point minus the reference’s', () => {
    const delta = deltaValues(
      new Float32Array([0, 1.5, 3.25]),
      new Float32Array([0, 1, 3])
    );

    expect(Array.from(delta)).toEqual([0, 0.5, 0.25]);
  });
});
