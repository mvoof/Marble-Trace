import { observer } from 'mobx-react-lite';
import { CrewStatus } from './CrewStatus';
import { CrewVoice } from './CrewVoice';
import { CrewDownloads } from './CrewDownloads';

/** Is the engineer ready, how they sound and hear, what they need downloaded. */
export const CrewOverview = observer(() => (
  <>
    <CrewStatus />

    <CrewVoice />

    <CrewDownloads />
  </>
));
