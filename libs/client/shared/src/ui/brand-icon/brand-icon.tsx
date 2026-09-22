import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const brandIconVariants = cva('shrink-0 select-none', {
  variants: {
    size: {
      xs: 'h-3 w-3',
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface BrandIconProps extends VariantProps<typeof brandIconVariants> {
  src: string;
  alt?: string;
  className?: string;
}

export function BrandIcon({ src, alt = '', size, className }: BrandIconProps) {
  const decorative = alt === '';

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn(brandIconVariants({ size }), className)}
    />
  );
}
