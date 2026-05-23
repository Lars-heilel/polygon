import { useForgotPasswordMutation } from '@org/entities-user';
import { toast } from '@org/shared';

export function useForgotPassword() {
  const { mutateAsync, isPending } = useForgotPasswordMutation();

  const forgotPassword = async (email: string) => {
    await mutateAsync(email);
    toast.success('Reset link sent — check your inbox');
  };

  return { forgotPassword, isPending };
}
