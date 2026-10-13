import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Bell, CheckCircle2, Info } from "lucide-react";

export default function Notifications() {
  const [items, setItems] = useState(null);
  const load = () => api.get("/student/notifications").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const markRead = async (id) => { await api.post(`/student/notifications/${id}/read`); load(); };

  if (!items) return <Loading />;
  return (
    <div className="max-w-2xl" data-testid="notifications-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Notifications</h1>
      {items.length === 0 ? <EmptyState title="No notifications" description="You're all caught up." /> : (
        <div className="mt-6 space-y-3">
          {items.map((n) => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)} className={`flex gap-3 border rounded-xl p-4 cursor-pointer ${n.read ? "bg-card" : "bg-blue-50 border-blue-200"}`} data-testid={`notif-${n.id}`}>
              {n.kind === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <Info className="h-5 w-5 text-[#2563EB] shrink-0" />}
              <div className="flex-1"><p className="font-semibold text-sm">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p><p className="text-xs text-muted-foreground mt-1">{n.created_at?.slice(0, 16).replace("T", " ")}</p></div>
              {!n.read && <span className="h-2 w-2 rounded-full bg-[#2563EB] mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
