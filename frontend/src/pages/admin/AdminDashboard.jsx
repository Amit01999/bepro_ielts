import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { StatCard } from "@/components/shared/StatCard";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Users, UserCheck, CreditCard, GraduationCap, FileText, Sparkles, ClipboardCheck, Layers } from "lucide-react";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(() => setData(null)); }, []);
  if (!data) return <Loading label="Loading admin console..." />;
  const c = data.cards;
  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-1">Operational overview of your IELTS platform.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mt-6">
        <StatCard label="Total Students" value={c.total_students} icon={Users} accent="#2563EB" testId="card-total-students" />
        <StatCard label="Active Students" value={c.active_students} icon={UserCheck} accent="#059669" testId="card-active-students" />
        <StatCard label="Paid Subscriptions" value={c.paid_subscriptions} icon={CreditCard} accent="#D97706" testId="card-paid" />
        <StatCard label="Active Batches" value={c.active_batches} icon={GraduationCap} accent="#7C3AED" testId="card-batches" />
        <StatCard label="Teachers" value={c.teachers} icon={Users} accent="#0891B2" testId="card-teachers" />
        <StatCard label="Published Exams" value={c.mock_tests} icon={FileText} accent="#2563EB" testId="card-exams" />
        <StatCard label="Tests Today" value={c.tests_today} icon={Layers} accent="#059669" testId="card-tests-today" />
        <StatCard label="Pending AI" value={c.pending_ai} icon={Sparkles} accent="#DC2626" testId="card-pending-ai" hint={`${c.pending_reviews} awaiting review`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Registrations (last 7 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.registration_trend}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip />
              <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Recent activity</h3>
          <div className="space-y-3">
            {data.recent_activity.length ? data.recent_activity.map((a) => (
              <div key={a.id} className="text-sm border-b last:border-0 pb-2" data-testid={`activity-${a.id}`}>
                <p className="font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{a.actor_name} · {a.timestamp?.slice(0, 16).replace("T", " ")}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
