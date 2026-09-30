import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import { timingSafeEqual } from 'node:crypto';
import { db } from './lib/db';
export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 3600 },
  providers: [
    ...(process.env.AUTH_GITHUB_ID ? [GitHub] : []),
    ...(process.env.DEMO_MODE === 'true'
      ? [
          Credentials({
            name: 'Local demo',
            credentials: { email: {}, password: {} },
            async authorize(credentials) {
              const expected = process.env.DEMO_PASSWORD;
              const provided = credentials.password;
              if (
                !expected ||
                typeof provided !== 'string' ||
                typeof credentials.email !== 'string'
              )
                return null;
              const a = Buffer.from(provided),
                b = Buffer.from(expected);
              if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
              return db.user.findUnique({
                where: { email: credentials.email.toLowerCase().trim() },
              });
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true;
      return (
        !!user.email &&
        !!(await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
        }))
      );
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const record = await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        token.sub = record?.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
