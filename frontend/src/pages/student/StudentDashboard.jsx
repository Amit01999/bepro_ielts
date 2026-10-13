import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { StatCard } from "@/components/shared/StatCard";
import { BandBadge } from "@/components/shared/BandBadge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { FileText, BookOpen, Sparkles, Trophy, Target, ArrowRight, TrendingDown } from "lucide-react";

const SKILLS = ["listening", "reading", "writing", "speaking"];

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/student/dashboard").then(({ data }) => setData(data)).catch(() => setData(null)); }, []);
  if (!data) return <Loading label="Loading your dashboard..." />;

  const sub = data.subscription;
  const items = sub.items || {};
  return (
    <div data-testid="student-dashboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display">Welcome back, {data.user.name.split(" ")[0]} 👋</h1>
          <p className="text-muted-foreground mt-1">Target: <span className="font-semibold text-foreground">Band {data.user.target_band?.toFixed(1)}</span> · {data.user.target_ielts_type === "general" ? "General Training" : "Academic"}</p>
        </div>
        <div className="flex items-center gap-3 bg-card border rounded-lg px-4 py-2">
          <div><p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Plan</p><p className="font-semibold">{sub.package_name}</p></div>
          {sub.source === "free" && <Link to="/app/subscription"><Button size="sm" className="bg-[#D97706] hover:bg-[#b45309] text-white" data-testid="dashboard-upgrade-btn">Upgrade</Button></Link>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
        <StatCard label="Tests Completed" value={data.tests_completed} icon={FileText} accent="#2563EB" testId="stat-tests" />
        <StatCard label="Practice Done" value={data.practice_completed} icon={BookOpen} accent="#059669" testId="stat-practice" />
        <StatCard label="Current Band" value={data.current_band ? data.current_band.toFixed(1) : "—"} icon={Trophy} accent="#D97706" testId="stat-current-band" />
        <StatCard label="AI Evaluations Left" value={items.ai?.unlimited ? "∞" : items.ai?.remaining ?? 0} icon={Sparkles} accent="#7C3AED" testId="stat-ai" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Band progress</h3>
          {data.band_history.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.band_history}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 9]} tick={{ fontSize: 11 }} />
                <Tooltip /><Line type="monotone" dataKey="overall" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">Complete a mock test to see your band trend.</p>}
        </div>
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Skill bands</h3>
          <div className="grid grid-cols-2 gap-4">
            {SKILLS.map((s) => (<div key={s} className="text-center"><BandBadge band={data.skill_bands[s]} size="sm" /><p className="text-xs mt-1 capitalize text-muted-foreground">{s}</p></div>))}
          </div>
          {data.weak_skill && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start gap-2">
              <TrendingDown className="h-4 w-4 text-[#D97706] mt-0.5" />
              <p className="text-sm text-amber-800">Focus area: <span className="font-semibold capitalize">{data.weak_skill}</span>. <Link to="/app/practice" className="underline">Practice now</Link></p>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="bg-card border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4"><h3 className="font-display font-bold text-lg">Recent results</h3><Link to="/app/results" className="text-sm text-[#2563EB]">View all</Link></div>
          {data.recent_results.length ? data.recent_results.map((r) => (
            <Link to={`/app/results/${r.id}`} key={r.id} className="flex items-center justify-between py-2.5 border-b last:border-0 hover:bg-muted/40 rounded px-2 -mx-2" data-testid={`recent-result-${r.id}`}>
              <div><p className="font-medium text-sm">{r.exam_title}</p><p className="text-xs text-muted-foreground">{r.created_at?.slice(0, 10)} · {r.status}</p></div>
              <BandBadge band={r.overall_band} size="sm" />
            </Link>
          )) : <p className="text-sm text-muted-foreground py-6 text-center">No results yet.</p>}
        </div>
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Jump back in</h3>
          <div className="space-y-3">
            <Link to="/app/mock-tests"><div className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/40" data-testid="quick-mock"><span className="flex items-center gap-3 font-medium"><FileText className="h-5 w-5 text-[#2563EB]" /> Take a mock test</span><ArrowRight className="h-4 w-4" /></div></Link>
            <Link to="/app/practice"><div className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/40" data-testid="quick-practice"><span className="flex items-center gap-3 font-medium"><BookOpen className="h-5 w-5 text-[#059669]" /> Practice a skill</span><ArrowRight className="h-4 w-4" /></div></Link>
            <Link to="/app/enter-exam"><div className="flex items-center justify-between border rounded-lg p-4 hover:bg-muted/40" data-testid="quick-examid"><span className="flex items-center gap-3 font-medium"><Target className="h-5 w-5 text-[#D97706]" /> Enter an Exam ID</span><ArrowRight className="h-4 w-4" /></div></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
