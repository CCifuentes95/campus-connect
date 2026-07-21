"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { homeForRole, isRole } from "@/lib/roles";

type Alert = { title: string; body: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);

  // Already signed in? Send them to their role home instead of showing the form.
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const { claims } = await user.getIdTokenResult();
      if (isRole(claims.role)) router.replace(homeForRole(claims.role));
    });
  }, [router]);

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
      const role = tokenResult.claims.role;

      if (!isRole(role)) {
        // Valid IBU account but not authorised for CampusConnect.
        await signOut(auth);
        setAlert({
          title: "Access denied for this account",
          body: "Your IBU account isn't authorised for CampusConnect. Contact the IT service desk to request access.",
        });
        return;
      }

      // Set the session cookie before navigating so SSR sees the user.
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: tokenResult.token }),
      });
      router.replace(homeForRole(role));
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        setAlert({
          title: "Incorrect email or password",
          body: "The details don't match an IBU account. Check for typos and try again.",
        });
      } else if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        setAlert({
          title: "No account found",
          body: "We couldn't find an IBU account for that email. Make sure you're using your official @ibu.edu address.",
        });
      } else {
        setAlert({
          title: "Sign-in failed",
          body: "Something went wrong signing you in. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f6f8fa]">
      {/* Brand panel */}
      <div className="hidden w-[46%] max-w-[620px] flex-col justify-between bg-[#0d2c49] p-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[11px] bg-[#d7a524] text-[20px] font-extrabold text-[#0d2c49]">
            IB
          </div>
          <div className="leading-tight">
            <div className="text-[18px] font-bold">CampusConnect</div>
            <div className="text-[12px] font-medium text-[#b6c6d5]">
              International Business University
            </div>
          </div>
        </div>
        <div>
          <h1 className="mb-4 text-[34px] font-bold leading-tight">
            Student support, all in one place.
          </h1>
          <p className="max-w-[400px] text-[15px] leading-relaxed text-[#b6c6d5]">
            Request academic help, book advising, and track everything from a
            single portal. Sign in with your IBU account to continue.
          </p>
        </div>
        <div />
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-[400px]">
          <h2 className="mb-1.5 text-[25px] font-bold text-[#0d2c49]">Sign in</h2>
          <p className="mb-6 text-[14.5px] leading-snug text-[#4a5b6b]">
            Use your IBU account. Your role and view are set automatically.
          </p>

          {alert ? (
            <div className="mb-5 rounded-xl border border-[#f0c4bd] bg-[#fdf0ee] p-3.5">
              <div className="text-[14px] font-semibold text-[#0d2c49]">
                {alert.title}
              </div>
              <div className="mt-0.5 text-[13px] leading-snug text-[#4a5b6b]">
                {alert.body}
              </div>
            </div>
          ) : null}

          <label className="mb-1.5 block text-[13px] font-semibold text-[#0d2c49]">
            IBU email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@ibu.edu"
            className="mb-4 w-full rounded-[11px] border-[1.5px] border-[#b6c6d5] bg-white px-3.5 py-3 text-[14.5px] text-[#0d2c49] outline-none focus:border-[#0d2c49]"
          />

          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[13px] font-semibold text-[#0d2c49]">
              Password
            </label>
            {/* Stub — password reset is not implemented in the MVP (US-01 task 4.4). */}
            <span
              aria-disabled
              title="Password reset is not available yet"
              className="cursor-not-allowed text-[13px] font-semibold text-[#7d8b99]"
            >
              Forgot?
            </span>
          </div>
          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[11px] border-[1.5px] border-[#b6c6d5] bg-white px-3.5 py-3 pr-16 text-[14.5px] text-[#0d2c49] outline-none focus:border-[#0d2c49]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#7d8b99]"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label className="my-4 flex cursor-pointer items-center gap-2 text-[13.5px] text-[#4a5b6b]">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="h-4 w-4 accent-[#064948]"
            />
            Keep me signed in on this device
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[11px] bg-[#d7a524] py-3.5 text-[15px] font-bold text-[#0d2c49] hover:bg-[#e6b52f] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="mt-6 text-center text-[12px] leading-relaxed text-[#7d8b99]">
            Your role (student, advisor, or admin) is determined by your IBU
            account — there&apos;s nothing to choose here.
          </p>
        </form>
      </div>
    </div>
  );
}
