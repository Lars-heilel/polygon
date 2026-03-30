import { useNavigate } from 'react-router';
import { CLIENT_ROUTES } from '@org/common';
import { toast } from '@org/shared';
import { useResetPasswordMutation } from '@org/entities';

export function useResetPassword() {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useResetPasswordMutation();

  const resetPassword = async (token: string, newPassword: string) => {
    await mutateAsync({ token, newPassword });
    toast.success('Password updated successfully');
    navigate(CLIENT_ROUTES.auth.login);
  };

  return { resetPassword, isPending };
}
