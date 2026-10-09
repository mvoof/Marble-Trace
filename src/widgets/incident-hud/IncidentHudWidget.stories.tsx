import type { Meta, StoryObj } from '@storybook/react-vite';

import { mockSafetyRating } from '@features/preview/mocks/safety-rating';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';
import { IncidentHudWidget } from './IncidentHudWidget';

interface StoryArgs {
  /** The sim has not sent the licence yet: no rating, so no estimate. */
  ratingUnknown?: boolean;
  /** A session that hands out no penalties: the PEN column leaves the row. */
  noPenalties?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/IncidentHudWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: IncidentHudWidget,
    size: { width: 180 },
    seed: (store, args) => {
      const sessionInfo = store.session.sessionInfo;

      if (args.noPenalties && sessionInfo) {
        store.session.updateSessionInfo({
          ...sessionInfo,
          incidentPenaltyInitial: null,
          incidentPenaltySubsequent: null,
        });
      }

      if (args.ratingUnknown) {
        store.player.updateSafetyRating(
          mockSafetyRating({
            driverIncidents: 2,
            srStart: null,
            srNow: null,
            srFinish: null,
            cleanCornersNeeded: null,
          })
        );
      }
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const CleanRace: Story = {
  parameters: previewScenario('incident-clean'),
};

export const MinorIncidents: Story = {
  parameters: previewScenario('incident-minor'),
};

/** A drive-through served and the next one a point away. */
export const PenaltyWarning: Story = {
  parameters: previewScenario('incident-penalty-warning'),
};

export const Disqualified: Story = {
  parameters: previewScenario('incident-dq'),
};

/** A league race: the points count, the rating does not move. */
export const Unranked: Story = {
  parameters: previewScenario('incident-unranked'),
};

export const NoPenalties: Story = {
  parameters: previewScenario('incident-minor'),
  args: { noPenalties: true },
};

export const NoSrYet: Story = {
  parameters: previewScenario('incident-clean'),
  args: { ratingUnknown: true },
};
