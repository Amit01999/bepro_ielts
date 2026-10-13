import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, BookOpen, PenLine, Mic, Lock, Clock } from "lucide-react";

const ICONS = { listening: Headphones, reading: BookOpen, writing: PenLine, speaking: Mic };

export default function Practice() {
  const [data, setData] = useState(null);
  const [skill, setSkill] = useState("");
  useEffect(() => { api.get("/student/practice", { params: skill ? { skill } : {} }).then(({ data }) => setData(data)).catch(() => setData({ items: [] })); }, [skill]);

  return (
    <div data-testid="practice-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Practice Center</h1>
      <p className="text-muted-foreground mt-1">Sharpen individual skills with instant feedback and explanations.</p>
      {data && <p className="text-sm mt-2">Practice remaining: <span className="font-semibold">{data.unlimited ? "Unlimited" : data.practice_remaining}</span></p>}

      <Tabs value={skill || "all"} onValueChange={(v) => setSkill(v === "all" ? "" : v)} className="mt-5">
        <TabsList data-testid="practice-skill-tabs">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          {["listening", "reading", "writing", "speaking"].map((s) => <TabsTrigger key={s} value={s} data-testid={`tab-${s}`} className="capitalize">{s}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {!data ? <Loading /> : data.items.length === 0 ? (
        <EmptyState title="No practice sets yet" description="Practice sets will appear here once published." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {data.items.map((p) => {
            const Icon = ICONS[p.skill] || BookOpen;
            const locked = !p.access?.allowed;
            return (
              <div key={p.id} className="bg-card border rounded-xl p-5 flex flex-col" data-testid={`practice-card-${p.id}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Icon className="h-5 w-5 text-[#2563EB]" /></div>
                  {p.is_free ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Free</Badge> : <Badge variant="outline" className="capitalize">{p.level}</Badge>}
                </div>
                <h3 className="font-display font-bold">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 capitalize">{p.skill} · {p.topic || "General"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {p.estimated_minutes} min</span>
                  <span>{p.question_count} questions</span>
                </div>
                <div className="mt-4 pt-4 border-t">
                  {locked ? (
                    <Link to="/app/subscription"><Button variant="outline" className="w-full" data-testid={`practice-locked-${p.id}`}><Lock className="h-4 w-4 mr-2" /> Upgrade to unlock</Button></Link>
                  ) : (
                    <Link to={`/app/practice/${p.id}`}><Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" data-testid={`practice-start-${p.id}`}>Start practice</Button></Link>
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
