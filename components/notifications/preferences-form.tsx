"use client";

// Preferences tab (US-06): the 4-row x 3-channel toggle matrix, persisted to
// users.notificationPrefs via savePreferences. Only In-app is functionally wired to a real
// send in this change — see the inline note on the Email/Push columns.
import { useActionState, useState } from "react";
import { savePreferences, type PreferencesState } from "@/lib/actions/notifications";
import {
  muteNonEssential,
  PREF_CHANNELS,
  PREF_ROWS,
  prefFieldName,
  type NotificationPrefs,
  type PrefChannel,
  type PrefRowKey,
} from "@/lib/notifications";

const CHANNEL_LABEL: Record<PrefChannel, string> = {
  email: "Email",
  push: "Push",
  inApp: "In-app",
};

const INITIAL: PreferencesState = { status: "idle" };

function Toggle({
  checked,
  name,
  ariaLabel,
  describedBy,
  onChange,
}: {
  checked: boolean;
  name: string;
  ariaLabel: string;
  describedBy?: string;
  onChange: () => void;
}) {
  return (
    <label className="relative inline-flex h-[22px] w-10 flex-shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <span
        className={`h-[22px] w-10 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--gold)] ${
          checked ? "bg-[color:var(--toggle-on)]" : "bg-[color:var(--toggle-off)]"
        }`}
      />
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${
          checked ? "translate-x-[20px]" : "translate-x-[2px]"
        }`}
      />
    </label>
  );
}

export function PreferencesForm({ initialPrefs }: { initialPrefs: NotificationPrefs }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [state, formAction, pending] = useActionState(savePreferences, INITIAL);

  function toggle(row: PrefRowKey, channel: PrefChannel) {
    setPrefs((p) => ({ ...p, [row]: { ...p[row], [channel]: !p[row][channel] } }));
  }

  return (
    <form action={formAction}>
      <p className="mb-5 max-w-[600px] text-[14.5px] leading-[1.6] text-body">
        Choose how you&apos;d like to hear from us. Turn channels on or off for each type of
        update.
      </p>

      <div className="mb-[22px] flex items-start gap-[11px] rounded-xl bg-teal-tint px-4 py-3.5">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p id="channel-status-note" className="text-[13.5px] leading-[1.5] text-ink">
          Essential updates about your <strong>active requests</strong> are always sent by
          email so nothing important slips by. Email and Push delivery are coming soon — only
          In-app notifications are live today.
        </p>
      </div>

      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-[0_1px_2px_var(--card-shadow)]">
        <div className="grid min-w-[560px] grid-cols-[1fr_76px_76px_76px] items-center gap-2.5 border-b border-line bg-page px-[22px] py-3.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.5px] text-muted">
            Notify me about
          </span>
          {PREF_CHANNELS.map((c) => (
            <span key={c} className="text-center text-[12px] font-bold text-muted-2">
              {CHANNEL_LABEL[c]}
            </span>
          ))}
        </div>
        {PREF_ROWS.map((row) => (
          <div
            key={row.key}
            className="grid min-w-[560px] grid-cols-[1fr_76px_76px_76px] items-center gap-2.5 border-b border-divider px-[22px] py-[18px] last:border-b-0"
          >
            <div className="pr-2">
              <div className="text-[14.5px] font-semibold text-ink">{row.label}</div>
              <div className="mt-0.5 text-[12.5px] leading-[1.45] text-muted">{row.desc}</div>
            </div>
            {PREF_CHANNELS.map((channel) => (
              <div key={channel} className="flex justify-center">
                <Toggle
                  checked={prefs[row.key][channel]}
                  name={prefFieldName(row.key, channel)}
                  ariaLabel={`${row.label} ${CHANNEL_LABEL[channel]}`}
                  describedBy={channel !== "inApp" ? "channel-status-note" : undefined}
                  onChange={() => toggle(row.key, channel)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3.5">
        <button
          type="button"
          onClick={() => setPrefs((p) => muteNonEssential(p))}
          className="inline-flex items-center gap-2 px-1 py-2.5 text-[13.5px] font-semibold text-muted-2 hover:text-ink"
        >
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
            <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
            <path d="M18 8a6 6 0 0 0-9.33-5" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          Mute all non-essential
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[11px] bg-gold px-[22px] py-3 text-[14px] font-bold text-navy hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-err">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-[12.5px] font-medium text-[color:var(--ok)]">
          Preferences saved.
        </p>
      ) : null}
    </form>
  );
}
