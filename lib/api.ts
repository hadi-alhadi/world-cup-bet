// Helpers for API route handlers: consistent error envelope + auth guards.
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Throwable guards — catch with `handle()` below for a clean route body.
export class HttpError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError("UNAUTHENTICATED", "Sign in required", 401);
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError("FORBIDDEN", "Admin only", 403);
  return user;
}

// Wrap a route body so thrown HttpErrors (and Zod errors) become JSON envelopes.
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.code, err.message, err.status);
    if (err && typeof err === "object" && "issues" in err) {
      return errorResponse("VALIDATION", "Invalid request body", 400);
    }
    console.error("Unhandled API error:", err);
    return errorResponse("INTERNAL", "Something went wrong", 500);
  }
}
