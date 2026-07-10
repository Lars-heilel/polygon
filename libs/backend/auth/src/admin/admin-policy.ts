import type { Role } from '@org/common';

export const canManage = (actorRole: Role, targetRole: Role, isSelf: boolean): boolean => {
  if (isSelf) return false;
  if (actorRole === 'CREATOR') return targetRole !== 'CREATOR';
  return actorRole === 'ADMIN' && (targetRole === 'MODERATOR' || targetRole === 'USER');
};
