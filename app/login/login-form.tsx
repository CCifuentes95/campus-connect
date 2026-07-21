"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { homeForRole, isRole, type Role } from "@/lib/roles";
import { alertForAuthError, type LoginAlert } from "./auth-errors";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<LoginAlert | null>(null);

  // Already signed in? Send them to their role home instead of showing the form.
  // Full navigation (not router.replace) so the server request carries the session cookie.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const { claims } = await user.getIdTokenResult();
      const role: Role = isRole(claims.role) ? claims.role : "student";
      window.location.assign(homeForRole(role));
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    try {
      await setPersistence(
        auth,
        keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
      );
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const tokenResult = await cred.user.getIdTokenResult(true);
      // Every IBU account is at least a student; advisors/admins carry an explicit claim.
      const role: Role = isRole(tokenResult.claims.role)
        ? tokenResult.claims.role
        : "student";

      // Set the session cookie before navigating so SSR sees the user. Use a full-page
      // navigation (not router.replace) so the destination's server request carries the
      // just-set httpOnly cookie — a soft navigation races the cookie and bounces to /login.
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: tokenResult.token }),
      });
      window.location.assign(homeForRole(role));
    } catch (err) {
      setAlert(alertForAuthError((err as { code?: string })?.code ?? ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-[400px]">
      <h2 className="mb-1.5 text-[25px] font-bold text-navy">Sign in</h2>
      <p className="mb-6 text-[14.5px] leading-snug text-body">
        Use your IBU account. Your role and view are set automatically.
      </p>

      {alert ? (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-alert-border bg-alert-bg p-3.5"
        >
          <div className="text-[14px] font-semibold text-navy">{alert.title}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-body">{alert.body}</div>
        </div>
      ) : null}

      <label
        htmlFor="email"
        className="mb-1.5 block text-[13px] font-semibold text-navy"
      >
        IBU email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@ibu.edu"
        className="mb-4 w-full rounded-[11px] border-[1.5px] border-field bg-white px-3.5 py-3 text-[14.5px] text-navy outline-none focus:border-navy"
      />

      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor="password" className="text-[13px] font-semibold text-navy">
          Password
        </label>
        {/* Stub — password reset is not implemented in the MVP (US-01 task 4.4). */}
        <span
          aria-disabled
          title="Password reset is not available yet"
          className="cursor-not-allowed text-[13px] font-semibold text-muted"
        >
          Forgot?
        </span>
      </div>
      <div className="relative mb-2">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-[11px] border-[1.5px] border-field bg-white px-3.5 py-3 pr-16 text-[14.5px] text-navy outline-none focus:border-navy"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-muted"
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>

      <label className="my-4 flex cursor-pointer items-center gap-2 text-[13.5px] text-body">
        <input
          type="checkbox"
          checked={keepSignedIn}
          onChange={(e) => setKeepSignedIn(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-[11px] bg-gold py-3.5 text-[15px] font-bold text-navy hover:bg-gold-hover disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-muted">
        Your role (student, advisor, or admin) is determined by your IBU account —
        there’s nothing to choose here.
      </p>
    </form>
  );
}
