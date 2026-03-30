import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI / Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Placeholder...' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    label: { control: 'text' },
    error: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: { label: 'Email', placeholder: 'you@example.com' },
};

export const WithHint: Story = {
  args: {
    label: 'Username',
    hint: 'Only letters, numbers and underscores',
    placeholder: 'john_doe',
  },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    error: 'Invalid email address',
    value: 'not-an-email',
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Search',
    leftIcon: <span>🔍</span>,
    placeholder: 'Search...',
  },
};

export const Disabled: Story = {
  args: { label: 'Email', disabled: true, value: 'disabled@example.com' },
};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-3 w-80">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};
