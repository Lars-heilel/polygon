import type { Meta, StoryObj } from '@storybook/react';
import { Heading } from './heading';

const meta: Meta<typeof Heading> = {
  title: 'UI / Typography / Heading',
  component: Heading,
  tags: ['autodocs'],
  argTypes: {
    level: {
      control: { type: 'select' },
      options: [1, 2, 3, 4, 5, 6],
    },
    as: {
      control: { type: 'select' },
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    },
    srOnly: { control: 'boolean' },
    children: { control: 'text' },
  },
  args: {
    children: 'The quick brown fox jumps',
    srOnly: false,
  },
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Level1: Story = { args: { level: 1 } };
export const Level2: Story = { args: { level: 2 } };
export const Level3: Story = { args: { level: 3 } };
export const Level4: Story = { args: { level: 4 } };
export const Level5: Story = { args: { level: 5 } };
export const Level6: Story = { args: { level: 6 } };

export const SemanticOverride: Story = {
  args: { level: 3, as: 'h1' },
  name: 'h1 tag — h3 style',
};

export const ScreenReaderOnly: Story = {
  args: { level: 2, srOnly: true },
  name: 'sr-only',
  decorators: [
    (Story) => (
      <div>
        <p style={{ fontSize: 14, opacity: 0.5 }}>
          Heading is in the DOM but not visible:
        </p>
        <Story />
      </div>
    ),
  ],
};

export const AllLevels: Story = {
  name: 'All Levels',
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level}>
          Level {level} — The quick brown fox
        </Heading>
      ))}
    </div>
  ),
};
