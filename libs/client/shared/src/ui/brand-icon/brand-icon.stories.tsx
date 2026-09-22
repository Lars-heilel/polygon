import type { Meta, StoryObj } from '@storybook/react';

import logoUrl from '../logo/favicon.svg';
import { BrandIcon } from './brand-icon';

const meta: Meta<typeof BrandIcon> = {
  title: 'UI / BrandIcon',
  component: BrandIcon,
  tags: ['autodocs'],
  args: { src: logoUrl },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof BrandIcon>;

export const Default: Story = {};

export const WithAlt: Story = { args: { alt: 'Polygon logo' } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <BrandIcon
        src={logoUrl}
        size="xs"
      />
      <BrandIcon
        src={logoUrl}
        size="sm"
      />
      <BrandIcon
        src={logoUrl}
        size="md"
      />
      <BrandIcon
        src={logoUrl}
        size="lg"
      />
    </div>
  ),
};
