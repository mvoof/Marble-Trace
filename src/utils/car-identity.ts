import { MOVING_CAR_FIELDS, type CarIdentity } from '@/types/car-identity';
import type { DriverEntry } from '@/types/bindings';

/**
 * Strips the four per-tick numbers off an entry, leaving what a widget draws.
 * The result is compared by content — see `BackendComputedStore` — so it must be
 * built by this one function and nowhere else, or two callers will disagree
 * about which fields count as movement.
 */
export const carIdentityOf = (entry: DriverEntry): CarIdentity => {
  const identity = { ...entry } as DriverEntry &
    Partial<Record<(typeof MOVING_CAR_FIELDS)[number], number>>;

  for (const field of MOVING_CAR_FIELDS) {
    delete identity[field];
  }

  return identity;
};
