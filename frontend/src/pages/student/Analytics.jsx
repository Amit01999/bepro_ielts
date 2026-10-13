import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";

const COLORS = { listening: "#2563EB", reading: "#059669", writing: "#D97706", speaking: "#7C3AED" };

export default function Analytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/student/analytics").then(({ data }) => setData(data)).catch(() => setData(null)); }, []);
  if (!data) return <Loading />;

  const hasTrend = Object.values(data.trends).some((a) => a.length > 0);
  return (
    <div data-testid="analytics-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Performance Analytics</h1>
      <p className="text-muted-foreground mt-1">Track your bands and discover weak areas. Target: Band {data.target_band?.toFixed(1)}</p>

      <div className="bg-card border rounded-xl p-6 mt-6">
        <h3 className="font-display font-bold text-lg mb-4">Band trends by skill</h3>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart>
              <XAxis dataKey="date" allowDuplicatedCategory={false} tick={{ fontSize: 11 }} type="category" />
              <YAxis domain={[0, 9]} tick={{ fontSize: 11 }} /><Tooltip />
              {Object.entries(data.trends).map(([sk, arr]) => arr.length > 0 && (
                <Line key={sk} data={arr} dataKey="band" name={sk} stroke={COLORS[sk]} strokeWidth={2.5} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState title="Not enough data yet" description="Complete mock tests to build your trend charts." />}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Question-type accuracy</h3>
          {data.question_type_accuracy.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.question_type_accuracy} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="type" width={110} tick={{ fontSize: 11 }} /><Tooltip />
                <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                  {data.question_type_accuracy.map((e, i) => <Cell key={i} fill={e.accuracy < 50 ? "#DC2626" : e.accuracy < 75 ? "#D97706" : "#059669"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-10 text-center">No question data yet.</p>}
        </div>
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-display font-bold text-lg mb-4">Recommended focus</h3>
          {data.weakest_types.length ? (
            <div className="space-y-3">
              {data.weakest_types.map((w) => (
                <div key={w.type} className="border rounded-lg p-4" data-testid={`weak-${w.type}`}>
                  <p className="font-semibold text-sm capitalize">{w.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.accuracy}% accuracy across {w.total} questions — practise this type to improve fastest.</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Complete tests to get recommendations.</p>}
        </div>
      </div>
    </div>
  );
}
