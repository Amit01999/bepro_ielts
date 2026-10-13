import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function QuestionBank() {
  const [items, setItems] = useState(null);
  const [skill, setSkill] = useState("");
  useEffect(() => { api.get("/questions", { params: skill ? { skill } : {} }).then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, [skill]);
  return (
    <div data-testid="admin-questionbank">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Question Bank</h1>
      <p className="text-muted-foreground mt-1">Reusable questions across exams and practice. Questions are also created inside the Exam Builder.</p>
      <Tabs value={skill || "all"} onValueChange={(v) => setSkill(v === "all" ? "" : v)} className="mt-5">
        <TabsList><TabsTrigger value="all">All</TabsTrigger>{["listening", "reading", "writing", "speaking"].map((s) => <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>)}</TabsList>
      </Tabs>
      {!items ? <Loading /> : items.length === 0 ? <EmptyState title="No standalone questions" description="Questions authored in the Exam Builder live inside their exams. Add reusable ones via the API or future forms." /> : (
        <div className="mt-6 space-y-3">
          {items.map((q) => (
            <div key={q.id} className="bg-card border rounded-lg p-4" data-testid={`qbank-${q.id}`}>
              <div className="flex items-center gap-2 mb-1"><Badge variant="outline" className="capitalize">{q.skill}</Badge><Badge variant="outline">{q.type}</Badge><Badge className="bg-slate-100 text-slate-700">{q.status}</Badge></div>
              <p className="text-sm">{q.prompt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
