import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export default function Reviews() {
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);
  const [band, setBand] = useState("");
  const [comments, setComments] = useState("");

  const load = () => api.get("/ai/reviews/pending").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post(`/ai/reviews/${active.id}`, { overall_band: band ? Number(band) : active.ai_score, comments, approved: true, criteria_scores: {} });
      toast.success("Review submitted"); setActive(null); setBand(""); setComments(""); load();
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!items) return <Loading />;
  return (
    <div data-testid="admin-reviews">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Writing & Speaking Reviews</h1>
      <p className="text-muted-foreground mt-1">AI evaluations awaiting teacher/examiner review. You can approve or override the band.</p>
      {items.length === 0 ? <EmptyState title="No pending reviews" description="Completed AI evaluations awaiting review will appear here." /> : (
        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          {items.map((ev) => (
            <div key={ev.id} className="bg-card border rounded-xl p-5" data-testid={`review-${ev.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#7C3AED]" /><span className="font-semibold capitalize">{ev.type} · Task {ev.question_number || ev.part}</span></div>
                <Badge className="bg-blue-100 text-blue-700">AI band {ev.ai_score?.toFixed(1)}</Badge>
              </div>
              {ev.prompt && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{ev.prompt}</p>}
              <div className="mt-3 bg-muted rounded-md p-3 text-sm max-h-32 overflow-y-auto">{ev.response_text || ev.transcript || "—"}</div>
              {active?.id === ev.id ? (
                <div className="mt-3 space-y-3">
                  <div><Label className="text-xs">Override band (blank = keep AI)</Label><Input value={band} onChange={(e) => setBand(e.target.value)} placeholder={String(ev.ai_score)} className="mt-1" data-testid={`review-band-${ev.id}`} /></div>
                  <Textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments for the student..." data-testid={`review-comments-${ev.id}`} />
                  <div className="flex gap-2"><Button size="sm" onClick={submit} className="bg-[#059669] text-white" data-testid={`submit-review-${ev.id}`}>Submit review</Button><Button size="sm" variant="outline" onClick={() => setActive(null)}>Cancel</Button></div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => { setActive(ev); setBand(""); setComments(""); }} data-testid={`open-review-${ev.id}`}>Review</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
