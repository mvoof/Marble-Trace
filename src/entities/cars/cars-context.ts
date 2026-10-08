import { createStoreContext } from '@shared/lib/store-context';
import type { CarsStore } from './cars.store';

export const [CarsContext, useCarsStore] =
  createStoreContext<CarsStore>('CarsStore');
