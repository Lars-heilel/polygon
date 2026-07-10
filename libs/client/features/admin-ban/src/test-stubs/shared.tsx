import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

export function Button({
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) {
  return (
    <button disabled={props.disabled || loading} {...props}>
      {children}
    </button>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  return message ? <div role="alert">{message}</div> : null;
}

export function Modal({
  isOpen,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return isOpen ? <div role="dialog">{children}</div> : null;
}

Modal.Header = function ModalHeader({ title }: { title: string }) {
  return <h2>{title}</h2>;
};

Modal.Body = function ModalBody({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
};

export function Textarea({
  label,
  error,
  maxChars: _maxChars,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  label?: string;
  maxChars?: number;
}) {
  return (
    <label>
      {label}
      <textarea aria-invalid={Boolean(error)} {...props} />
      {error && <span>{error}</span>}
    </label>
  );
}

export function Input({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label>
      {label}
      <input aria-invalid={Boolean(error)} {...props} />
      {error && <span>{error}</span>}
    </label>
  );
}

export const toast = {
  error: jest.fn(),
  success: jest.fn(),
};
