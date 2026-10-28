import type { AuthProfile } from '../auth/auth.service';

export function canReadClass(user: AuthProfile, classId: string): boolean {
  if (['ADMIN', 'COORDINATOR', 'VIEWER'].includes(user.role)) return true;
  return user.role === 'COACH' && user.sailingClasses.some(item => item.id === classId);
}

export function canWriteClass(user: AuthProfile, classId: string): boolean {
  if (['ADMIN', 'COORDINATOR'].includes(user.role)) return true;
  return user.role === 'COACH' && user.sailingClasses.some(item => item.id === classId);
}
