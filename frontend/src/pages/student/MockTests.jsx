import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, BookOpen, PenLine, Mic, Layers, Lock, Clock } from "lucide-react";

const ICONS = { listening: Headphones, reading: BookOpen, writing: PenLine, speaking: Mic, full: Layers };

export default function MockTests() {
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState("");
  useEffect(() => { api.get("/student/exams", { params: kind ? { kind } : {} }).then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, [kind]);

  return (
    <div data-testid="mock-tests-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Mock Tests</h1>
      <p className="text-muted-foreground mt-1">Realistic, server-timed exams. Full mocks and single-skill tests.</p>

      <Tabs value={kind || "all"} onValueChange={(v) => setKind(v === "all" ? "" : v)} className="mt-5">
        <TabsList data-testid="mock-kind-tabs">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="full">Full Mock</TabsTrigger>
          <TabsTrigger value="listening">Listening</TabsTrigger>
          <TabsTrigger value="reading">Reading</TabsTrigger>
          <TabsTrigger value="writing">Writing</TabsTrigger>
        </TabsList>
      </Tabs>

      {!items ? <Loading /> : items.length === 0 ? (
        <EmptyState title="No exams available" description="Published exams will appear here." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {items.map((e) => {
            const Icon = ICONS[e.kind] || Layers;
            const locked = !e.access?.allowed;
            return (
              <div key={e.id} className="bg-card border rounded-xl p-5 flex flex-col" data-testid={`exam-card-${e.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Icon className="h-5 w-5 text-[#2563EB]" /></div>
                  {e.is_free ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Free</Badge> : <Badge variant="outline" className="capitalize">{e.kind}</Badge>}
                </div>
                <h3 className="font-display font-bold">{e.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{e.ielts_type === "general" ? "General Training" : "Academic"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {e.duration_minutes} min</span>
                  <span>{e.question_count} questions</span>
                  {e.ai_evaluation && <Badge variant="outline" className="text-[10px]">AI feedback</Badge>}
                </div>
                {!locked && !e.is_free && !e.access?.unlimited && <p className="text-xs text-muted-foreground mt-2">{e.access.remaining} attempts left</p>}
                <div className="mt-4 pt-4 border-t">
                  {locked ? (
                    <Link to="/app/subscription"><Button variant="outline" className="w-full" data-testid={`exam-locked-${e.id}`}><Lock className="h-4 w-4 mr-2" /> Upgrade to unlock</Button></Link>
                  ) : (
                    <Link to={`/app/exam-intro/${e.id}`}><Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" data-testid={`exam-start-${e.id}`}>Start exam</Button></Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
