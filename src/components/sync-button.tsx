"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

type SyncResponse = {
  ok?: boolean;
  imported?: number;
  points?: number;
  error?: string;
};

export function SyncButton({
  label = "Sync plays",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4200);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSync() {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
      });

      let payload: SyncResponse | null = null;
      try {
        payload = (await res.json()) as SyncResponse;
      } catch {
        payload = null;
      }

      if (res.status === 401) {
        setError("Sign in again to sync your listening.");
        return;
      }

      if (!res.ok || !payload || payload.ok === false) {
        setError(payload?.error || `Sync failed (${res.status}). Try again.`);
        return;
      }

      if (payload.error) {
        // Soft failure: request succeeded but no plays were imported.
        setError(payload.error);
      } else if (mounted.current) {
        const imported = typeof payload.imported === "number" ? payload.imported : 0;
        const gained = typeof payload.points === "number" ? payload.points : 0;
        if (imported > 0) {
          setSuccess(
            `Synced ${imported} ${imported === 1 ? "play" : "plays"}${gained > 0 ? ` · +${gained} pts` : ""}`,
          );
        } else {
          setSuccess("Up to date — no new plays since the last sync.");
        }
      }

      router.refresh();
    } catch {
      setError("Network error — could not reach the sync endpoint.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  const shimmer = pending && !reduce;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleSync}
        disabled={pending}
        aria-busy={pending}
        className={`btn btn-primary relative overflow-hidden active:scale-[0.97] ${className}`.trim()}
      >
        {shimmer ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
            animate={{ x: ["0%", "420%"] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
        {success && !pending ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-full bg-lime/25"
            initial={{ opacity: 0.9, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.35 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ) : null}

        {pending ? (
          <svg
            className="relative h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : success ? (
          <svg
            className="relative h-4 w-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2.5 8.5 6 12l7.5-8" />
          </svg>
        ) : null}
        <span className="relative">{pending ? "Syncing" : label}</span>
      </button>
      <p
        aria-live="polite"
        role="status"
        className={`min-h-[1rem] text-xs ${error ? "text-magenta" : success ? "text-lime" : "text-muted"}`}
      >
        {error ?? success ?? ""}
      </p>
    </div>
  );
}

export default SyncButton;
