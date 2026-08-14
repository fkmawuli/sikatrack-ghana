import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can, findRequiredPermission } from "@/lib/rbac";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname.startsWith("/login");

  if (!isLoggedIn && !isLoginPage) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (isLoggedIn) {
    const permission = findRequiredPermission(pathname);
    if (permission && !can(req.auth!.user.role, permission)) {
      return NextResponse.redirect(new URL("/dashboard?denied=1", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  // Skip API routes (handled per-route with requireUser/requirePermission),
  // Next internals, and static files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
