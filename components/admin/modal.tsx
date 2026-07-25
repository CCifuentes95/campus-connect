"use client";

// Shared dialog for the admin People & access screens.
//
// Escape is bound on `document`, not the dialog element: a keydown handler on the container
// only fires when focus is already inside it, which it isn't until something is focused. The
// dialog takes focus on mount and returns it to the opener on close, so keyboard users don't
// get dropped at the top of the page.

import { useEffect, useRef } from "react";

export function Modal({
  children,
  labelledBy,
  onClose,
  narrow,
}: {
  children: React.ReactNode;
  labelledBy: string;
  onClose: () => void;
  narrow?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-scrim p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`my-auto w-full rounded-2xl border border-line bg-card p-[26px] shadow-[0_24px_60px_rgba(3,14,26,0.35)] outline-none ${
          narrow ? "max-w-[430px]" : "max-w-[640px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
