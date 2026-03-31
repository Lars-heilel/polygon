import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '../../lib/utils/cn';

const headingVariants = cva('font-sans font-bold tracking-tight', {
  variants: {
    level: {
      1: 'text-3xl md:text-4xl lg:text-5xl',
      2: 'text-2xl md:text-3xl lg:text-4xl',
      3: 'text-xl  md:text-2xl lg:text-3xl',
      4: 'text-lg  md:text-xl  lg:text-2xl',
      5: 'text-base md:text-lg  lg:text-xl',
      6: 'text-sm  md:text-base lg:text-lg',
    },
  },
  defaultVariants: {
    level: 1,
  },
});

type Level = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  level: Level;
  as?: HeadingTag;
  srOnly?: boolean;
}

export function Heading({
  level,
  as,
  srOnly = false,
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = (as ?? `h${level}`) as HeadingTag;

  return (
    <Tag
      className={cn(srOnly ? 'sr-only' : headingVariants({ level }), className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
