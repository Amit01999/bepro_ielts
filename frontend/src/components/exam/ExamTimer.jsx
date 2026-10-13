import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { fmtTime } from "@/lib/utils";

// Server-authoritative timer: seeded with server remaining_seconds, ticks locally, calls onExpire once.
export function ExamTimer({ remainingSeconds, onExpire }) {
  const [remaining, setRemaining] = useState(remainingSeconds);
  const fired = useRef(false);

  useEffect(() => {
    setRemaining(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (!fired.current) {
            fired.current = true;
            onExpire && onExpire();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onExpire]);

  const low = remaining <= 300;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border font-mono-nums font-bold ${
        low ? "bg-red-50 border-red-300 text-red-600 timer-alert" : "bg-muted border-border text-foreground"
      }`}
      data-testid="exam-timer"
    >
      <Clock className="h-4 w-4" />
      <span>{fmtTime(remaining)}</span>
    </div>
  );
}
