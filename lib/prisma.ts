// Prisma client backed by the libSQL driver adapter so the SAME code runs against
// a local SQLite file (dev/QA) and Turso (prod) with only env changes.
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function localFileUrl(): string {
  // The Prisma CLI resolves DATABASE_URL="file:./dev.db" relative to the schema dir
  // (prisma/), giving <root>/prisma/dev.db. The libSQL runtime resolves relative to
  // cwd, so we point it at the SAME absolute file to avoid a split-brain database.
  const abs = path.resolve(process.cwd(), "prisma", "dev.db");
  return `file:${abs}`;
}

function makeClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const url = tursoUrl || localFileUrl();
  const authToken = tursoUrl ? process.env.TURSO_AUTH_TOKEN : undefined;

  const libsql = createClient({ url, authToken });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
