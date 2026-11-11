"use client";

import { useState } from "react";

/**
 * Live points calculator. Mirrors the server scoring rules:
 * - minutes: capped at 8 minutes per track
 * - distinct tracks: +10 each, max 20 per artist per day
 * - daily activity: +5 when at least one play exists
 * total = minutes + 10 * min(distinctTracks, 20) + (plays > 0 ? 5 : 0)
 */
export function PointsCalculator() {
  const [minutes, setMinutes] = useState(0);
  const [distinctTracks, setDistinctTracks] = useState(0);
  const [hasPlay, setHasPlay] = useState(true);

  const cappedMinutes = Math.min(Math.max(minutes, 0), 480); // 8 hours max for display sanity
  const trackBonus = 10 * Math.min(Math.max(distinctTracks, 0), 20);
  const activityBonus = hasPlay ? 5 : 0;
  const total = cappedMinutes + trackBonus + activityBonus;

  return (
    <section aria-label="Points calculator" className="scroll-mt-24 space-y-4">
      <div className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
              Points calculator
            </p>
            <h3 className="font-display text-base font-semibold tracking-tight text-fg">
              What does one day of listening earn?
            </h3>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display text-2xl font-bold tracking-tight text-lime">
              {total}
            </span>
            <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted">
              points
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <CalculatorInput
            label="Listening minutes"
            unit="min"
            hint="Capped at 8 min per track"
            value={cappedMinutes}
            max={480}
            onChange={(value) => setMinutes(value)}
          />
          <CalculatorInput
            label="Distinct tracks"
            unit="tracks"
            hint="+10 each, max 20"
            value={distinctTracks}
            max={50}
            onChange={(value) => setDistinctTracks(value)}
          />
          <CalculatorInput
            label="Activity bonus"
            unit="+5"
            hint="When you play anything today"
            value={hasPlay ? 5 : 0}
            max={5}
            onChange={(checked) => setHasPlay(checked === 1)}
            type="toggle"
          />
        </div>

        <div className="mt-4 border-t border-line/60 pt-3">
          <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.12em]">
            <span className="text-muted">Listening minutes</span>
            <span className="text-fg/80 num">{cappedMinutes}</span>
          </div>
          <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.12em] mt-1">
            <span className="text-muted">New-track bonus</span>
            <span className="text-fg/80 num">{trackBonus}</span>
          </div>
          <div className="flex items-center justify-between text-[0.58rem] uppercase tracking-[0.12em] mt-1">
            <span className="text-muted">Daily activity</span>
            <span className="text-fg/80 num">{activityBonus}</span>
          </div>
          <div className="mt-2 border border-line/40 bg-panel2/40 rounded-lg p-2">
            <div className="flex items-center justify-between font-mono text-xs text-fg">
              <span>Total per day</span>
              <span>{total}</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[0.58rem] leading-relaxed text-muted">
          Points = minutes + 10 × distinct tracks (max 20) + 5 daily activity bonus.
          Scores reset weekly, monthly and yearly on their own boards.
        </p>
      </div>
    </section>
  );
}

function CalculatorInput({
  label,
  unit,
  hint,
  value,
  max,
  onChange,
  type = "number",
}: {
  label: string;
  unit: string;
  hint: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  type?: "number" | "toggle";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs font-semibold tracking-tight text-fg">
          {label}
        </span>
        <span className="font-mono text-[0.58rem] text-lime">{unit}</span>
      </div>
      {type === "toggle" ? (
        <button
          onClick={() => onChange(value > 0 ? 0 : 1)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-panel2 px-3 py-1.5 text-[0.58rem] uppercase tracking-[0.1em] text-muted transition hover:border-lime/50 hover:text-lime"
        >
          {value > 0 ? (
            <>
              <span className="text-lime">On</span>
              <span className="w-1 h-1 rounded-full bg-lime" aria-hidden="true" />
            </>
          ) : (
            <>
              <span className="text-muted">Off</span>
              <span className="w-1 h-1 rounded-full bg-line/50" aria-hidden="true" />
            </>
          )}
        </button>
      ) : (
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          className="w-full rounded-md border border-line bg-panel2 px-3 py-2 font-mono text-[0.75rem] tabular-nums text-fg focus:border-lime/50 focus:outline-none transition"
        />
      )}
      <p className="text-[0.52rem] text-muted">{hint}</p>
    </div>
  );
}
