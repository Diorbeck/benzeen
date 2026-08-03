import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter } from 'next-auth/adapters';
import { ensureSuperAdminFromEnv } from '@/lib/bootstrap';
import { verifyCode } from '@/lib/verification';
import { resolveReferrer } from '@/lib/referral';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Login', type: 'text' },
        password: { label: 'Password', type: 'password' },
        mode: { label: 'Mode', type: 'text' },
        vehicleNumber: { label: 'Vehicle Number', type: 'text' },
        ref: { label: 'Referral', type: 'text' },
      },
      async authorize(credentials) {
        try {
          await ensureSuperAdminFromEnv();
        } catch (e) {
          console.error('[auth] bootstrap error:', e);
        }

        if (!credentials?.identifier || !credentials?.password) return null;

        const mode =
          credentials.mode === 'driver'
            ? 'driver'
            : credentials.mode === 'courier'
              ? 'courier'
              : credentials.mode === 'client'
                ? 'client'
                : 'default';

        // Client sign-in (B2C): phone + one-time SMS code. No password. The
        // `password` field carries the 6-digit OTP. A CLIENT account is created
        // on first successful verification.
        if (mode === 'client') {
          try {
            const phone = credentials.identifier.trim();
            const verified = await verifyCode({
              identifier: phone,
              code: credentials.password,
              purpose: 'client_auth',
            });
            if (!verified.ok) return null;

            let user = await prisma.user.findFirst({ where: { phone } });
            if (user && user.role !== 'CLIENT') {
              // Phone belongs to a staff account (driver/courier/etc.) — they
              // must use their own login, not the client OTP flow.
              return null;
            }
            if (!user) {
              const synthEmail = `${phone.replace(/\D/g, '')}@clients.benzeen.local`;
              // Referral binding — only for brand-new users; ignore self/unknown.
              let referredById: string | null = null;
              const ref = credentials.ref?.trim();
              if (ref) {
                try {
                  referredById = await resolveReferrer(ref, phone);
                } catch {
                  referredById = null;
                }
              }
              user = await prisma.user.create({
                data: { phone, email: synthEmail, role: 'CLIENT', referredById },
              });
            }
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              companyId: user.companyId,
              image: null,
            };
          } catch (e) {
            console.error('[auth] client authorize error:', e);
            return null;
          }
        }

        try {
          let user;
          if (mode === 'driver') {
            const phone = credentials.identifier.trim();
            user = await prisma.user.findFirst({
              where: { phone, role: 'DRIVER' },
              include: { driverCars: { include: { car: true } } },
            });

            if (!user?.passwordHash) return null;

            const vehicleNumber = credentials.vehicleNumber?.trim();
            if (vehicleNumber) {
              const owns = user.driverCars.some(
                (dc) =>
                  dc.car.plateNumber.trim().toLowerCase() ===
                  vehicleNumber.toLowerCase()
              );
              if (!owns) return null;
            }
          } else if (mode === 'courier') {
            const phone = credentials.identifier.trim();
            user = await prisma.user.findFirst({
              where: { phone, role: 'COURIER' },
            });
            if (!user?.passwordHash) return null;
          } else {
            const email = credentials.identifier.trim().toLowerCase();
            user = await prisma.user.findUnique({ where: { email } });
          }

          if (!user?.passwordHash) return null;

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            image: null,
          };
        } catch (e) {
          console.error('[auth] authorize error:', e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.companyId = token.companyId as string | null;
      }
      return session;
    },
  },
};
