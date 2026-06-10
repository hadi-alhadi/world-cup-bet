// NextAuth v5 route handlers. Node runtime — Prisma (used in callbacks) needs Node, not edge.
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
