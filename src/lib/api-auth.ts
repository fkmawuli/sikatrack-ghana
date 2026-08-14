import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can, type Permission } from "@/lib/rbac";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws ApiError(401) if not logged in, or ApiError(403) if missing the permission. */
export async function requireUser(permission?: Permission) {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Not authenticated");
  if (permission && !can(session.user.role, permission)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  return session.user;
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
