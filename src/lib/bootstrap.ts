import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';

const globalForBootstrap = globalThis as unknown as {
  __benzeen_bootstrap_ran__?: boolean;
};

export async function ensureSuperAdminFromEnv() {
  if (globalForBootstrap.__benzeen_bootstrap_ran__) return;
  globalForBootstrap.__benzeen_bootstrap_ran__ = true;

  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();

  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
    },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
      companyId: null,
    },
  });
}

