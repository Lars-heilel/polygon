import type { Meta, StoryObj } from '@storybook/react';
import { StatusScreen } from './status-screen';
import { Button } from '../button/button';

const meta: Meta<typeof StatusScreen> = {
  title: 'UI / StatusScreen',
  component: StatusScreen,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['error', 'success', 'info'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof StatusScreen>;

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Check your email',
    description:
      'We sent a verification link to user@example.com. Click the link to activate your account.',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Email verified!',
    description: 'Your account is now active. You can sign in.',
  },
};

export const ErrorVariant: Story = {
  name: 'Error',
  args: {
    variant: 'error',
    title: 'Something went wrong',
    description: 'The verification link is invalid or has expired.',
  },
};

export const WithActions: Story = {
  args: {
    variant: 'info',
    title: 'Check your email',
    description: 'We sent a verification link to user@example.com.',
  },
  render: (args) => (
    <StatusScreen {...args}>
      <Button variant="secondary" size="sm">
        Resend email
      </Button>
    </StatusScreen>
  ),
};

export const CheckEmailPage: Story = {
  name: 'Auth / Check Email',
  render: () => (
    <StatusScreen
      variant="info"
      title="Check your email"
      description="We sent a verification link to user@example.com. Click the link to activate your account."
    >
      <Button variant="secondary" size="sm">
        Resend email
      </Button>
    </StatusScreen>
  ),
};

export const EmailVerifiedPage: Story = {
  name: 'Auth / Email Verified',
  render: () => (
    <StatusScreen
      variant="success"
      title="Email verified!"
      description="Your account is now active."
    >
      <Button variant="primary" size="sm">
        Sign in
      </Button>
    </StatusScreen>
  ),
};

export const ErrorPage: Story = {
  name: 'Auth / Expired Link',
  render: () => (
    <StatusScreen
      variant="error"
      title="Link expired"
      description="This verification link is invalid or has already been used."
    >
      <Button variant="secondary" size="sm">
        Request new link
      </Button>
    </StatusScreen>
  ),
};
