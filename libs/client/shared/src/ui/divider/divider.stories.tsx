import type { Meta, StoryObj, Decorator } from '@storybook/react';
import { Divider } from './divider';

const meta: Meta<typeof Divider> = {
  title: 'UI / Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Divider>;

const wrapW80: Decorator = (Story) => <div className="w-80"><Story /></div>;

export const Horizontal: Story = {
  decorators: [wrapW80],
};

export const WithLabel: Story = {
  args: { label: 'or continue with' },
  decorators: [wrapW80],
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 h-12">
        <span className="text-sm text-text-muted">Left</span>
        <Story />
        <span className="text-sm text-text-muted">Right</span>
      </div>
    ),
  ],
};
