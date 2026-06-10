// NextAuth v5 full instance (Node runtime). Spreads the edge-safe authConfig and adds
// the providers/callbacks that need Prisma (handoff §11):
//  - Google (real): @privilee.ae restricted via hd param + server-side domain check.
//  - Dev Credentials: enabled when AUTH_DEV_MODE=true so QA/Playwright can sign in as a
//    seeded user without Google. NEVER enable in production.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEV_MODE = process.env.AUTH_DEV_MODE === "true";

function isPrivileeEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@privilee.ae");
}

function roleFor(email: string): "USER" | "ADMIN" {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? "ADMIN" : "USER";
}

// Find or create the local User row and keep admin status in sync with ADMIN_EMAILS.
async function upsertUser(email: string, name?: string | null, image?: string | null) {
  const role = roleFor(email);
  return prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, name: name ?? null, image: image ?? null, role },
  });
}

const devProviders = DEV_MODE
  ? [
      Credentials({
        id: "dev",
        name: "Dev Login",
        credentials: { email: { label: "Email", type: "email" } },
        async authorize(creds) {
          const email = String(creds?.email ?? "").trim().toLowerCase();
          if (!email || !isPrivileeEmail(email)) return null;
          const user = await upsertUser(email, email.split("@")[0]);
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        },
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...devProviders],
  callbacks: {
    ...authConfig.callbacks,
    // Domain restriction for Google (the hd param alone is not security, §14.2).
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email || !isPrivileeEmail(user.email)) return false;
        await upsertUser(user.email, user.name, user.image);
      }
      return true;
    },
    // Resolve id + role from the DB once we have an email; baked into the JWT so the
    // edge session callback (auth.config.ts) can read them without a DB hit.
    async jwt({ token }) {
      if (token.email) {
        const user = await prisma.user.findUnique({ where: { email: token.email } });
        if (user) {
          token.uid = user.id;
          token.role = user.role;
        }
      }
      return token;
    },
  },
});

export interface CurrentUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  name?: string | null;
  image?: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
    name: session.user.name,
    image: session.user.image,
  };
}
