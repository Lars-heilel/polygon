import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'UI / Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size:   { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    status: { control: 'select', options: [undefined, 'online', 'away', 'offline'] },
    name:   { control: 'text' },
    src:    { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithInitials: Story = { args: { name: 'John Doe' } };
export const WithImage: Story   = { args: { src: 'https://i.pravatar.cc/150?img=3', name: 'Jane Smith' } };
export const Fallback: Story    = {};

export const Statuses: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar name="Online User"  status="online" />
      <Avatar name="Away User"    status="away" />
      <Avatar name="Offline User" status="offline" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <Avatar key={size} name="Alex Kim" size={size} status="online" />
      ))}
    </div>
  ),
};
