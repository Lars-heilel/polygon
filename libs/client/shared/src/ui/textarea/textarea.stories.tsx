import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI / Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: { placeholder: 'Write a message...' },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    label: { control: 'text' },
    error: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    maxChars: { control: 'number' },
    rows: { control: 'number' },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: { label: 'Message', rows: 4 },
};

export const WithHint: Story = {
  args: { label: 'Bio', hint: 'Tell us about yourself', rows: 3 },
};

export const WithError: Story = {
  args: { label: 'Message', error: 'Message is too short', rows: 4 },
};

export const WithCharCounter: Story = {
  args: { label: 'Message', maxChars: 200, rows: 4, value: 'Hello world' },
};

export const Disabled: Story = {
  args: {
    label: 'Message',
    disabled: true,
    value: 'Disabled content',
    rows: 3,
  },
};
