import { zodResolver } from '@hookform/resolvers/zod';
import { CLIENT_ROUTES, registerSchema } from '@org/common';
import { Button, Divider, FormAlert, Input } from '@org/shared';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { OAuthButtons } from './oauth-buttons';

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

interface RegisterFormProps {
  onSubmit: (values: RegisterFormValues) => Promise<void>;
  apiError?: string | null;
}

export function RegisterForm({ onSubmit, apiError }: RegisterFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <OAuthButtons />

      <Divider label="or" />

      <div className="space-y-3">
        <Input
          {...register('username')}
          label="Username"
          placeholder="john_doe"
          error={errors.username?.message}
          autoComplete="username"
        />
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
          autoComplete="new-password"
        />
        <Input
          {...register('confirmPassword')}
          type="password"
          label="Confirm password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
        />
      </div>

      <FormAlert message={apiError ?? null} />

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
      >
        Create account
      </Button>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link
          to={CLIENT_ROUTES.auth.login}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
