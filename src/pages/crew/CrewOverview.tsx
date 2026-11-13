import { observer } from 'mobx-react-lite';
import { CrewStatus } from './CrewStatus';
import { CrewVoice } from './CrewVoice';

/** Is the engineer ready, and how they sound and hear. */
export const CrewOverview = observer(() => (
  <>
    <CrewStatus />

    <CrewVoice />
  </>
));
