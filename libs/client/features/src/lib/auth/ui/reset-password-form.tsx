import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router';
import { PasswordRegex, CLIENT_ROUTES } from '@org/common';
import { Button, Input } from '@org/shared';

const schema = z
  .object({
    password: z.string().regex(PasswordRegex.REGEX, PasswordRegex.MESSAGE),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type ResetPasswordFormValues = z.infer<typeof schema>;

interface ResetPasswordFormProps {
  onSubmit: (
    values: ResetPasswordFormValues & { token: string }
  ) => Promise<void>;
}

export function ResetPasswordForm({ onSubmit }: ResetPasswordFormProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(schema) });

  if (isSubmitSuccessful) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-text-muted">
          Password updated successfully.
        </p>
        <Link
          to={CLIENT_ROUTES.auth.login}
          className="text-sm text-primary hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-danger">Invalid or expired reset link.</p>
        <Link
          to={CLIENT_ROUTES.auth.forgotPassword}
          className="text-sm text-primary hover:underline"
        >
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ ...values, token }))}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-3">
        <Input
          {...register('password')}
          type="password"
          label="New password"
          placeholder="••••••••"
          error={errors.password?.message}
          autoComplete="new-password"
        />
        <Input
          {...register('confirmPassword')}
          type="password"
          label="Confirm new password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Set new password
      </Button>
    </form>
  );
}
