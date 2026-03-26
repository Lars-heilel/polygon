import type { Meta, StoryObj } from '@storybook/react';
import { IconButton } from './icon-button';

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const meta: Meta<typeof IconButton> = {
  title: 'UI / IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: { icon: <SendIcon />, label: 'Send message' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size:    { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story  = {};
export const Primary: Story  = { args: { variant: 'primary' } };
export const Danger: Story   = { args: { variant: 'danger', icon: <CloseIcon />, label: 'Remove' } };
export const Loading: Story  = { args: { loading: true } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <IconButton key={size} icon={<SendIcon />} label="Send" size={size} variant="primary" />
      ))}
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton icon={<SendIcon />}  label="Send"   variant="primary" />
      <IconButton icon={<SendIcon />}  label="Send"   variant="secondary" />
      <IconButton icon={<SendIcon />}  label="Send"   variant="ghost" />
      <IconButton icon={<CloseIcon />} label="Remove" variant="danger" />
    </div>
  ),
};
