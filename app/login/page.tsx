import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · CampusConnect",
};

// Server component: the brand panel is static and stays server-rendered; only the
// interactive form (login-form.tsx) is a client component.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-surface">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center p-8">
        <LoginForm />
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="hidden w-[46%] max-w-[620px] flex-col justify-between bg-navy p-14 text-white lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[11px] bg-gold text-[20px] font-extrabold text-navy">
          IB
        </div>
        <div className="leading-tight">
          <div className="text-[18px] font-bold">CampusConnect</div>
          <div className="text-[12px] font-medium text-navy-muted">
            International Business University
          </div>
        </div>
      </div>
      <div>
        <h1 className="mb-4 text-[34px] font-bold leading-tight">
          Student support, all in one place.
        </h1>
        <p className="max-w-[400px] text-[15px] leading-relaxed text-navy-muted">
          Request academic help, book advising, and track everything from a single
          portal. Sign in with your IBU account to continue.
        </p>
      </div>
      <div />
    </div>
  );
}
