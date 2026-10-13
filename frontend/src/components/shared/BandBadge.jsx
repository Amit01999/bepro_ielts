import { bandColor } from "@/lib/utils";

export function BandBadge({ band, label, size = "md", testId }) {
  const sizes = {
    sm: "h-10 w-10 text-base",
    md: "h-16 w-16 text-2xl",
    lg: "h-24 w-24 text-4xl",
  };
  const color = bandColor(band);
  return (
    <div className="flex flex-col items-center gap-1" data-testid={testId}>
      <div
        className={`${sizes[size]} font-mono-nums font-bold rounded-full flex items-center justify-center text-white shadow-sm`}
        style={{ backgroundColor: color }}
      >
        {band == null ? "—" : Number(band).toFixed(1)}
      </div>
      {label && <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>}
    </div>
  );
}
