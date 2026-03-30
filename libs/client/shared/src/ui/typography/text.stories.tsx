import type { Meta, StoryObj } from '@storybook/react';
import { Text } from './text';

const meta: Meta<typeof Text> = {
  title: 'UI / Typography / Text',
  component: Text,
  tags: ['autodocs'],
  args: { children: 'The quick brown fox jumps over the lazy dog' },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    color: {
      control: 'select',
      options: ['default', 'muted', 'danger', 'inherit'],
    },
    weight: { control: 'select', options: ['normal', 'medium', 'semibold'] },
    as: { control: 'select', options: ['p', 'span', 'label', 'li', 'div'] },
    srOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="space-y-2">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <Text key={size} size={size}>
          [{size}] The quick brown fox
        </Text>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="space-y-2">
      <Text color="default">Default</Text>
      <Text color="muted">Muted</Text>
      <Text color="danger">Danger</Text>
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="space-y-2">
      <Text weight="normal">Normal weight</Text>
      <Text weight="medium">Medium weight</Text>
      <Text weight="semibold">Semibold weight</Text>
    </div>
  ),
};

export const AsTags: Story = {
  render: () => (
    <div className="space-y-2">
      <Text as="p">As paragraph</Text>
      <Text as="label" size="sm" weight="medium">
        As label
      </Text>
      <Text as="span" color="muted" size="sm">
        As span
      </Text>
    </div>
  ),
};
