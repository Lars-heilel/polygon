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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function IconButton({
  icon,
  label,
  children,
  ...props
}: {
  icon?: ReactNode;
  label?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button aria-label={label ?? props['aria-label']} {...props}>{icon ?? children}</button>;
}

function DropdownRoot({
  isOpen,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return <div>{children}</div>;
}

DropdownRoot.Trigger = function DropdownTrigger({ children }: { children: ReactNode }) {
  return <>{children}</>;
};

DropdownRoot.Menu = function DropdownMenu({ isOpen, children }: { isOpen?: boolean; children: ReactNode }) {
  return <div role="menu" hidden={isOpen === false}>{children}</div>;
};

DropdownRoot.Item = function DropdownItem({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
};

DropdownRoot.Divider = function DropdownDivider() {
  return <hr />;
};

export const Dropdown = DropdownRoot;

export function Heading({ children }: { children: ReactNode }) {
  return <h2>{children}</h2>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div data-testid="skeleton" className={className} />;
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return children;
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

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<]+[^<.,:;"')\]\s])/gi;

function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  const withProtocol = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;

  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function extractLinks(text: string) {
  const matches = text.match(URL_REGEX) ?? [];
  return Array.from(new Set(matches.map(normalizeLink).filter(Boolean))) as string[];
}

export function splitTextByLinks(text: string): Array<{ type: 'text' | 'link'; value: string }> {
  const parts: Array<{ type: 'text' | 'link'; value: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const index = match.index ?? 0;
    const rawLink = match[0];

    if (index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, index) });
    }

    parts.push({ type: 'link', value: normalizeLink(rawLink) ?? rawLink });
    lastIndex = index + rawLink.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}

export function Text({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}

let linkPreviewStub: unknown = null;

export function __setLinkPreviewStub(value: unknown) {
  linkPreviewStub = value;
}

export function __resetLinkPreviewStub() {
  linkPreviewStub = null;
}

export function useLinkPreviewQuery() {
  return { data: linkPreviewStub };
}
