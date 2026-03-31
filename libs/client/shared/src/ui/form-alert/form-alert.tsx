import { cva } from 'class-variance-authority';

import { Text } from '../typography/text';

const alertVariants = cva('rounded-md px-3 py-2', {
  variants: {
    variant: {
      error: 'bg-danger/10',
      success: 'bg-success/10',
      info: 'bg-primary/10',
    },
  },
  defaultVariants: { variant: 'error' },
});

const textColor = {
  error: 'danger',
  success: 'success',
  info: 'primary',
} as const;

interface FormAlertProps {
  message: string | null;
  variant?: 'error' | 'success' | 'info';
}

export function FormAlert({ message, variant = 'error' }: FormAlertProps) {
  if (!message) return null;

  return (
    <div
      className={alertVariants({ variant })}
      role="alert"
    >
      <Text
        size="sm"
        color={textColor[variant]}
      >
        {message}
      </Text>
    </div>
  );
}
