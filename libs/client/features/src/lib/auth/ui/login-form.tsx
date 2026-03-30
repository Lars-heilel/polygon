import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type z } from 'zod';
import { Link } from 'react-router';
import { loginSchema, CLIENT_ROUTES } from '@org/common';
import { Button, Input, Divider } from '@org/shared';
import { OAuthButtons } from './oauth-buttons';

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <OAuthButtons />

      <Divider label="or" />

      <div className="space-y-3">
        <Input
          {...register('email')}
          type="email"
          label="Email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
        />
        <Input
          {...register('password')}
          type="password"
          label="Password"
          placeholder="••••••••"
          error={errors.password?.message}
          autoComplete="current-password"
        />
      </div>

      <div className="flex justify-end">
        <Link
          to={CLIENT_ROUTES.auth.forgotPassword}
          className="text-xs text-text-muted hover:text-text transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>

      <p className="text-center text-sm text-text-muted">
        Don't have an account?{' '}
        <Link
          to={CLIENT_ROUTES.auth.register}
          className="text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
