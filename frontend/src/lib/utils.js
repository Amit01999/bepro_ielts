import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function bandColor(band) {
  if (band == null) return "#475569";
  if (band >= 8.5) return "#047857";
  if (band >= 7.5) return "#059669";
  if (band >= 6.5) return "#2563EB";
  if (band >= 5.5) return "#D97706";
  return "#DC2626";
}

export function fmtTime(seconds) {
  if (seconds == null || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
