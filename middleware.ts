// Edge middleware (handoff §11). Runs on the edge — only reads `req.auth` from the JWT,
// NEVER touches Prisma (id + role are already baked into the token by lib/auth callbacks).
//
// Rules:
//  - Unauthenticated → redirect to /login (except /login, /api/auth/*, Next internals).
//  - /admin/* or /api/admin/* by a non-ADMIN → pages redirect to /, API returns 403 JSON.
import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe instance: authConfig has NO Prisma imports, so this bundles for the edge.
// It only decodes the existing JWT (id + role already baked in at sign-in).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  // Always reachable: the login flow itself, and the sync endpoint (it self-guards via
  // admin session OR cron secret, so Vercel Cron — which has no session — can reach it).
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/dev-login" ||
    pathname === "/api/admin/sync" ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const user = req.auth?.user;

  // Unauthenticated → bounce to login (preserve intended destination for pages).
  if (!user) {
    if (isApi) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required" } },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin areas require role ADMIN. Token carries role — no DB hit here.
  if (isAdminPath && user.role !== "ADMIN") {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin only" } },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Skip Next internals, favicon, and static asset files; guard everything else.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
