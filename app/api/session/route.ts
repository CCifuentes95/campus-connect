// Session bridge: the client posts its fresh Firebase ID token here; we store it as an
// httpOnly cookie so SSR (FirebaseServerApp) can read Firestore as the user. DELETE clears
// it on sign-out. Node runtime (Firebase SDK needs Node APIs).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/firebase/config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof idToken !== "string" || idToken.length === 0) {
    return NextResponse.json({ error: "missing idToken" }, { status: 400 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, idToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // ID tokens live ~1h; the client refreshes and re-posts.
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
