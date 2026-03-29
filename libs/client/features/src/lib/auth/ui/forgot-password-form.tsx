import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { Button, Input } from '@org/shared';

const schema = z.object({ email: z.email() });

export type ForgotPasswordFormValues = z.infer<typeof schema>;

interface ForgotPasswordFormProps {
  onSubmit: (values: ForgotPasswordFormValues) => Promise<void>;
}

export function ForgotPasswordForm({ onSubmit }: ForgotPasswordFormProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } =
    useForm<ForgotPasswordFormValues>({ resolver: zodResolver(schema) });

  if (isSubmitSuccessful) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-text-muted">
          We sent a reset link to your email. Check your inbox.
        </p>
        <Link to={CLIENT_ROUTES.auth.login} className="text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        {...register('email')}
        type="email"
        label="Email"
        placeholder="you@example.com"
        error={errors.email?.message}
        autoComplete="email"
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-text-muted">
        <Link to={CLIENT_ROUTES.auth.login} className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
