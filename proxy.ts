// Next 16 renamed `middleware` -> `proxy` (Node.js runtime by default).
// OPTIMISTIC gate only: redirect unauthenticated requests to /login based on cookie
// presence. Real authorization is firestore.rules + the per-route role checks in the
// route-group layouts (see app/(student|staff|admin)/layout.tsx). Never trust this alone.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/config";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next internals, and static files (anything with a dot).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
