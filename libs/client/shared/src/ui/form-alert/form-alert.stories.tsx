import type { Meta, StoryObj } from '@storybook/react';
import { FormAlert } from './form-alert';

const meta: Meta<typeof FormAlert> = {
  title: 'UI / FormAlert',
  component: FormAlert,
  tags: ['autodocs'],
  args: { message: 'Something went wrong. Please try again.' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['error', 'success', 'info'],
    },
    message: { control: 'text' },
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
type Story = StoryObj<typeof FormAlert>;

export const Error: Story = {
  args: { variant: 'error', message: 'This email is already registered.' },
};

export const Success: Story = {
  args: { variant: 'success', message: 'Email sent — check your inbox.' },
};

export const Info: Story = {
  args: { variant: 'info', message: 'Please wait before requesting another email.' },
};

export const Hidden: Story = {
  args: { message: null },
  name: 'Hidden (null message)',
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-2 w-96">
      <FormAlert variant="error" message="This email is already registered." />
      <FormAlert variant="success" message="Email sent — check your inbox." />
      <FormAlert variant="info" message="Please wait before requesting another email." />
    </div>
  ),
};

export const AuthErrors: Story = {
  name: 'Auth error messages',
  render: () => (
    <div className="space-y-2 w-96">
      <FormAlert variant="error" message="This email is already registered." />
      <FormAlert variant="error" message="Invalid email or password." />
      <FormAlert variant="error" message="Too many attempts. Please try again later." />
      <FormAlert variant="error" message="Registration failed. Please try again." />
    </div>
  ),
};
