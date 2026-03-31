import type { Meta, StoryObj } from '@storybook/react';

import { Avatar } from '../avatar/avatar';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI / Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: '3' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'surface', 'danger', 'muted'],
    },
    size: { control: 'select', options: ['sm', 'md'] },
    dot: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Danger: Story = { args: { variant: 'danger', children: '99+' } };
export const Dot: Story = { args: { dot: true, variant: 'primary' } };

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Badge variant="primary">12</Badge>
      <Badge variant="surface">New</Badge>
      <Badge variant="danger">99+</Badge>
      <Badge variant="muted">Draft</Badge>
    </div>
  ),
};

export const WithAvatar: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="relative inline-flex">
        <Avatar name="Alex Kim" />
        <Badge
          variant="danger"
          className="absolute -top-1 -right-1"
        >
          5
        </Badge>
      </div>
      <div className="relative inline-flex">
        <Avatar name="Sam Lee" />
        <Badge
          dot
          variant="primary"
          className="absolute bottom-0 right-0"
        />
      </div>
    </div>
  ),
};
