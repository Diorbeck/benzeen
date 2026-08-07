// Shared SUPER_ADMIN gate for admin API routes (PR-C). Returns the actor id +
// email for audit logging, or an { error, status } to hand straight to the caller.
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export type SuperAdminGuard =
  | { ok: true; actorId: string | null; actorEmail: string | null }
  | { error: string; status: 401 | 403 };

export async function requireSuperAdmin(): Promise<SuperAdminGuard> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: 'Unauthorized', status: 401 };
  const { role, id, email } = session.user as {
    role?: string;
    id?: string;
    email?: string;
  };
  if (role !== 'SUPER_ADMIN') return { error: 'Forbidden', status: 403 };
  return { ok: true, actorId: id ?? null, actorEmail: email ?? null };
}
