import { CLIENT_ROUTES } from '@org/common';
import { useResetPasswordMutation } from '@org/entities-user';
import { toast } from '@org/shared';
import { useNavigate } from 'react-router';

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
