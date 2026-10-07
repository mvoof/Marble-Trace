import { createStoreContext } from '@utils/store-context';
import type { CarsStore } from './cars.store';

export const [CarsContext, useCarsStore] =
  createStoreContext<CarsStore>('CarsStore');
