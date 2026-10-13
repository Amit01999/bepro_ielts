import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { BandBadge } from "@/components/shared/BandBadge";
import { Badge } from "@/components/ui/badge";

export default function ResultsList() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/student/results").then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, []);
  if (!items) return <Loading />;
  return (
    <div data-testid="results-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">My Results</h1>
      <p className="text-muted-foreground mt-1">Your completed tests and estimated band scores.</p>
      {items.length === 0 ? <EmptyState title="No results yet" description="Take a mock test to see results here." /> : (
        <div className="mt-6 space-y-3">
          {items.map((r) => (
            <Link to={`/app/results/${r.id}`} key={r.id} className="flex items-center justify-between bg-card border rounded-xl p-5 hover:shadow-md transition-shadow" data-testid={`result-row-${r.id}`}>
              <div>
                <p className="font-display font-bold">{r.exam_title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{r.created_at?.slice(0, 10)} · {r.ielts_type === "general" ? "General" : "Academic"} {r.kind}</p>
                <div className="flex gap-2 mt-2">
                  {Object.entries(r.skills || {}).map(([sk, v]) => (
                    <Badge key={sk} variant="outline" className="capitalize text-xs">{sk}: {v.band != null ? v.band.toFixed(1) : (v.status === "QUEUED" || v.status === "PROCESSING" ? "…" : "—")}</Badge>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <BandBadge band={r.overall_band} size="md" />
                <Badge className={`mt-2 ${r.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} hover:bg-transparent`}>{r.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
