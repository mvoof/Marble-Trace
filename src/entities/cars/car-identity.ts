import {
  MOVING_CAR_FIELDS,
  type CarIdentity,
} from '@shared/contracts/car-identity';
import type { DriverEntry } from '@shared/contracts/driver-entry';

const MOVING_FIELDS: ReadonlySet<string> = new Set(MOVING_CAR_FIELDS);

/**
 * Strips the per-tick numbers off an entry, leaving what a widget draws.
 * The result is compared by content — see `BackendComputedStore` — so it must be
 * built by this one function and nowhere else, or two callers will disagree
 * about which fields count as movement.
 *
 * Copies the kept fields rather than spreading the entry and deleting the
 * moving ones: a `delete` turns every identity into a dictionary-mode object,
 * several times the size of the one built here.
 */
export const carIdentityOf = (entry: DriverEntry): CarIdentity => {
  const identity: Record<string, unknown> = {};

  for (const field in entry) {
    if (!MOVING_FIELDS.has(field)) {
      identity[field] = entry[field as keyof DriverEntry];
    }
  }

  return identity as CarIdentity;
};

const isIdentityOf = (identity: CarIdentity, entry: DriverEntry): boolean => {
  for (const field in identity) {
    if (
      identity[field as keyof CarIdentity] !== entry[field as keyof DriverEntry]
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Hands back the identity a car had last time while nothing in it changed, so
 * a field of 64 cars costs 64 new objects only when all 64 changed — and a
 * list of identities can be compared by reference instead of by content.
 *
 * One cache per list: a car's last identity in the standings says nothing
 * about its last one in the relative.
 */
export class CarIdentityCache {
  private readonly byCarIdx = new Map<number, CarIdentity>();

  identitiesOf(entries: readonly DriverEntry[]): CarIdentity[] {
    return entries.map((entry) => this.identityOf(entry));
  }

  clear() {
    this.byCarIdx.clear();
  }

  private identityOf(entry: DriverEntry): CarIdentity {
    const previous = this.byCarIdx.get(entry.carIdx);

    if (previous && isIdentityOf(previous, entry)) {
      return previous;
    }

    const identity = carIdentityOf(entry);

    this.byCarIdx.set(entry.carIdx, identity);

    return identity;
  }
}
