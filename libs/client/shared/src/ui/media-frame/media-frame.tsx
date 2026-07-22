import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/utils/cn.js';

export interface MediaFrameProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  width?: number | null;
  height?: number | null;
  maxWidth?: number;
  fixedSize?: number;
  shape?: 'rounded' | 'circle';
}

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 160;

export function MediaFrame({
  children,
  width,
  height,
  maxWidth = DEFAULT_WIDTH,
  fixedSize,
  shape = 'rounded',
  className,
  style,
  ...props
}: MediaFrameProps) {
  const safeWidth = width && width > 0 ? width : DEFAULT_WIDTH;
  const safeHeight = height && height > 0 ? height : DEFAULT_HEIGHT;

  const frameStyle: CSSProperties = fixedSize
    ? {
        width: fixedSize,
        height: fixedSize,
        ...style,
      }
    : {
        width: '100%',
        maxWidth,
        aspectRatio: `${safeWidth} / ${safeHeight}`,
        ...style,
      };

  return (
    <div
      {...props}
      style={frameStyle}
      className={cn(
        'relative block shrink-0 overflow-hidden bg-surface-elevated',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        className,
      )}
    >
      {children}
    </div>
  );
}
