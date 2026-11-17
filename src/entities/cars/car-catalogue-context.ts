import { createStoreContext } from '@shared/lib/store-context';
import type { CarCatalogueStore } from './car-catalogue.store';

export const [CarCatalogueContext, useCarCatalogueStore] =
  createStoreContext<CarCatalogueStore>('CarCatalogueStore');
