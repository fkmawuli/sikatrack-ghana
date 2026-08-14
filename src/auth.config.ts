import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config: no providers, no Prisma, no bcrypt. This is the
 * only auth config the middleware (an Edge Function) is allowed to import —
 * pulling in the Credentials provider here would bundle Prisma Client into
 * middleware and blow past Vercel's Edge Function size limit. The full config
 * (src/auth.ts) extends this with the Prisma-backed Credentials provider and
 * only runs in the Node.js runtime (API routes, server components).
 */
export default {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 hour session expiry
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id!;
        token.role = user.role;
        token.businessId = user.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.businessId = token.businessId;
      return session;
    },
  },
} satisfies NextAuthConfig;
