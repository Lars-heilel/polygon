import { createContext, useContext, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { QueryClient } from '@tanstack/react-query';

const ModalCloseContext = createContext<(() => void) | null>(null);
export const queryClient = new QueryClient();

export function Avatar({ name }: { name?: string | null }) {
  return <div data-testid="avatar">{name}</div>;
}

export function Spinner() {
  return <div role="status">Loading</div>;
}

export function Button({
  children,
  loading,
  disabled,
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button disabled={disabled || loading} {...props}>{loading ? 'Loading' : children}</button>;
}

export function IconButton({
  icon,
  label,
  ...props
}: {
  icon: ReactNode;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button aria-label={label} {...props}>{icon}</button>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div data-testid="skeleton" className={className} />;
}

export function MediaFrame({
  children,
  width,
  height,
  maxWidth = 280,
  fixedSize,
  shape = 'rounded',
  className,
  style,
  ...props
}: {
  children?: ReactNode;
  width?: number | null;
  height?: number | null;
  maxWidth?: number;
  fixedSize?: number;
  shape?: 'rounded' | 'circle';
} & HTMLAttributes<HTMLDivElement>) {
  const frameStyle: CSSProperties = fixedSize
    ? { width: fixedSize, height: fixedSize, ...style }
    : {
        width: '100%',
        maxWidth,
        aspectRatio: `${width && width > 0 ? width : 280} / ${height && height > 0 ? height : 160}`,
        ...style,
      };

  return (
    <div
      {...props}
      style={frameStyle}
      className={cn(shape === 'circle' ? 'rounded-full' : 'rounded-lg', className)}
    >
      {children}
    </div>
  );
}

export function Modal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <ModalCloseContext.Provider value={onClose}>
      <div role="dialog">{children}</div>
    </ModalCloseContext.Provider>
  );
}

Modal.Header = function ModalHeader({ title }: { title: string }) {
  const onClose = useContext(ModalCloseContext);

  return (
    <div>
      <h2>{title}</h2>
      <button type="button" aria-label="Close" onClick={() => onClose?.()}>Close</button>
    </div>
  );
};

Modal.Body = function ModalBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

export const authedFetch = jest.fn(async <T,>(): Promise<T> => {
  throw new Error('authedFetch is not implemented in tests');
});

export function frontendLog() {
  /* no-op */
}

export const socket = {
  emit: () => undefined,
};

export function formatTime(value: string) {
  return value;
}

export function formatAudioTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

interface AudioTrackStub {
  id: string;
  url: string;
  title: string;
  subtitle?: string | null;
}

interface AudioTrackCall {
  track: AudioTrackStub;
  options?: { queue?: AudioTrackStub[]; index?: number };
}

const audioTrackCalls: AudioTrackCall[] = [];

export function useAudioTrack(track: AudioTrackStub, options?: AudioTrackCall['options']) {
  audioTrackCalls.push({ track, options });

  return {
    isCurrent: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    toggle: () => undefined,
    seek: () => undefined,
  };
}

export function __getAudioTrackCalls() {
  return audioTrackCalls;
}

export function __resetAudioTrackStub() {
  audioTrackCalls.length = 0;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function extractLinks() {
  return [];
}

export function splitTextByLinks(text: string): Array<{ type: 'text'; value: string }> {
  return [{ type: 'text', value: text }];
}

export function Text({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

export function useLinkPreviewQuery() {
  return { data: null };
}
