import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils/cn';

const textVariants = cva('font-sans', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
    color: {
      default: 'text-text',
      muted: 'text-text-muted',
      danger: 'text-danger',
      inherit: '',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
    },
  },
  defaultVariants: {
    size: 'md',
    color: 'default',
    weight: 'normal',
  },
});

type TextTag = 'p' | 'span' | 'label' | 'li' | 'div';

interface TextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'color'>,
    VariantProps<typeof textVariants> {
  as?: TextTag;
  srOnly?: boolean;
}

export function Text({
  as: Tag = 'p',
  size,
  color,
  weight,
  srOnly = false,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(
        srOnly ? 'sr-only' : textVariants({ size, color, weight }),
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
