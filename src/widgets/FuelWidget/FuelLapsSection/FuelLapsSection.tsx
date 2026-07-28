import { observer } from 'mobx-react-lite';

import { FuelLapsToEmptyRow } from './FuelLapsToEmptyRow/FuelLapsToEmptyRow';
import { FuelSummaryRow } from './FuelSummaryRow/FuelSummaryRow';

export const FuelLapsSection = observer(() => {
  return (
    <>
      <FuelLapsToEmptyRow />
      <FuelSummaryRow />
    </>
  );
});
