import type { Period } from "./types";

const DAY_MS = 86_400_000;

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(now: Date = new Date()): string {
  return toDay(now);
}

export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  return toDay(new Date(d.getTime() + delta * DAY_MS));
}

export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d;
}

export function periodRange(period: Period, now: Date = new Date()): {
  start: string;
  end: string;
  key: string;
  label: string;
  prevStart: string;
  prevEnd: string;
} {
  if (period === "week") {
    const start = mondayOf(now);
    const end = new Date(start.getTime() + 6 * DAY_MS);
    const prevStart = new Date(start.getTime() - 7 * DAY_MS);
    const prevEnd = new Date(start.getTime() - DAY_MS);
    return {
      start: toDay(start),
      end: toDay(end),
      key: isoWeekKey(start),
      label: `Week ${isoWeekKey(start).split("-W")[1]}`,
      prevStart: toDay(prevStart),
      prevEnd: toDay(prevEnd),
    };
  }

  if (period === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const label = start.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    return {
      start: toDay(start),
      end: toDay(end),
      key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      label,
      prevStart: toDay(prevStart),
      prevEnd: toDay(prevEnd),
    };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  const prevStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const prevEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31));
  return {
    start: toDay(start),
    end: toDay(end),
    key: String(start.getUTCFullYear()),
    label: String(start.getUTCFullYear()),
    prevStart: toDay(prevStart),
    prevEnd: toDay(prevEnd),
  };
}

export const PERIOD_LABEL: Record<Period, string> = {
  week: "This week",
  month: "This month",
  year: "This year",
};

export function isPeriod(value: string | null | undefined): value is Period {
  return value === "week" || value === "month" || value === "year";
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(points);
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
