// Edge-safe NextAuth config (no Prisma / Node-only imports) so middleware can run on
// the edge runtime. The full instance in lib/auth.ts spreads this and adds the
// DB-touching providers/callbacks (which only run in the Node route handler).
import type { NextAuthConfig, DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "USER" | "ADMIN" } & DefaultSession["user"];
  }
}

const googleProviders =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // No single-domain `hd` hint: we allow both privilee.ae and privilee.com.
          // The server-side signIn callback enforces the allowed domains — the real gate.
          authorization: { params: { prompt: "select_account" } },
        }),
      ]
    : [];

export const authConfig = {
  // Credentials (dev) provider is added in lib/auth.ts because its authorize() hits Prisma.
  providers: googleProviders,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // No DB here — id/role are baked into the token by the jwt callback in lib/auth.ts.
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
