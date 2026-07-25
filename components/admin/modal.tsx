"use client";

// Shared dialog for the admin People & access screens.
//
// Escape is bound on `document`, not the dialog element: a keydown handler on the container
// only fires when focus is already inside it, which it isn't until something is focused. The
// dialog takes focus on mount and returns it to the opener on close, so keyboard users don't
// get dropped at the top of the page.
//
// Tab is trapped inside the dialog. `aria-modal="true"` tells assistive tech the rest of the
// page is inert, so letting Tab walk out into it would make that claim false.

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

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

  // `onClose` is a fresh closure on every parent render. Reading it through a ref keeps the
  // mount effect's dep list empty — otherwise the effect tears down and re-runs on each
  // keystroke, and its cleanup/setup pair yanks focus back to the dialog mid-typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const trapTab = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;

    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;

    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
      else trapTab(e);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
    // Mount/unmount only — see onCloseRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto overscroll-contain bg-scrim p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        // Programmatic focus target only — never reachable by Tab, so suppressing the ring
        // here hides an artifact rather than removing a real focus indicator.
        tabIndex={-1}
        className={`my-auto w-full overscroll-contain rounded-2xl border border-line bg-card p-[26px] shadow-[0_24px_60px_rgba(3,14,26,0.35)] outline-none ${
          narrow ? "max-w-[430px]" : "max-w-[640px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
