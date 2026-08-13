import type { Meta, StoryObj } from '@storybook/react';
import type { FlagType } from '@/types';
import { DriverFlagBadge } from './DriverFlagBadge';

const meta: Meta<typeof DriverFlagBadge> = {
  title: 'Components/DriverFlagBadge',
  component: DriverFlagBadge,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div
        style={
          {
            background: '#1a1a2e',
            padding: '24px',
            borderRadius: '8px',
            '--wfs': '3',
          } as React.CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DriverFlagBadge>;

export const Blue: Story = { args: { type: 'blue' } };
export const Meatball: Story = { args: { type: 'meatball' } };
export const Black: Story = { args: { type: 'black' } };
export const Penalty: Story = { args: { type: 'penalty' } };
export const Checkered: Story = { args: { type: 'checkered' } };
export const Dq: Story = { args: { type: 'dq' } };

const ALL_TYPES: FlagType[] = [
  'blue',
  'meatball',
  'black',
  'penalty',
  'checkered',
  'dq',
];

export const AllFlags: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {ALL_TYPES.map((type) => (
        <div
          key={type}
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <DriverFlagBadge type={type} />
          <span
            style={{ color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}
          >
            {type}
          </span>
        </div>
      ))}
    </div>
  ),
};
