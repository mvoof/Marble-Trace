import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CrewRadioEvent } from '@shared/contracts/generated/bindings';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { CrewRadioWidget } from './CrewRadioWidget';

type Exchange = 'reply' | 'speaking' | 'listening' | 'refused' | 'quiet';

interface StoryArgs {
  exchange: Exchange;
  /** The widget's own setting, a Control already — named for the stories that set it. */
  history?: 'current' | 'recent';
}

const ASKED_FUEL: CrewRadioEvent[] = [
  { kind: 'listening', on: true },
  { kind: 'listening', on: false },
  { kind: 'heard', text: 'fuel forty litres', understood: true },
  { kind: 'command', ok: true, text: 'Copy, forty litres at the stop.' },
  { kind: 'speaking', text: 'Copy, forty litres at the stop.' },
];

const EXCHANGES: Record<Exchange, CrewRadioEvent[]> = {
  reply: [...ASKED_FUEL, { kind: 'finished' }],
  speaking: ASKED_FUEL,
  listening: [
    ...ASKED_FUEL,
    { kind: 'finished' },
    { kind: 'listening', on: true },
  ],
  refused: [
    { kind: 'listening', on: true },
    { kind: 'listening', on: false },
    { kind: 'heard', text: 'change the wing', understood: false },
    { kind: 'speaking', text: 'Say again, I did not get that.' },
  ],
  quiet: [],
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/CrewRadioWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: CrewRadioWidget,
    // The plate paints its own ground from --widget-bg and is as tall as its
    // lines; the frame around it stays empty, as the transparent container
    // does on the overlay.
    size: {
      width: 320,
      background: 'transparent',
      widgetBg: 'rgba(21, 22, 26, 0.8)',
      border: 'none',
    },
    seed: (store, args) => {
      store.crewRadio.reset();

      for (const event of EXCHANGES[args.exchange]) {
        store.crewRadio.apply(event);
      }
    },
    args: {
      exchange: 'reply',
    },
    argTypes: {
      exchange: {
        control: { type: 'select' },
        options: Object.keys(EXCHANGES),
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** A fuel order carried out, its answer on the air under it — the race look. */
export const Reply: Story = {
  args: {
    exchange: 'speaking',
    history: 'recent',
  },
};

/** The answer over, the plate up for a moment after it. */
export const Answered: Story = {
  args: {
    history: 'recent',
  },
};

/** The engineer's answer on the air, the current line alone. */
export const Speaking: Story = {
  args: {
    exchange: 'speaking',
  },
};

/** Push-to-talk held again under the last exchange. */
export const Listening: Story = {
  args: {
    exchange: 'listening',
    history: 'recent',
  },
};

/** A sentence that is not a command the crew knows. */
export const Refused: Story = {
  args: {
    exchange: 'refused',
    history: 'recent',
  },
};

/** Nothing on the air — the plate the layout editor shows. */
export const Quiet: Story = {
  args: {
    exchange: 'quiet',
  },
};
