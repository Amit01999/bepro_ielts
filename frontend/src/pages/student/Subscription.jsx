import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Loading } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";

export default function Subscription() {
  const { refresh } = useAuth();
  const [pkgs, setPkgs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [ent, setEnt] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () => {
    api.get("/packages").then(({ data }) => setPkgs(data.items));
    api.get("/student/subscriptions").then(({ data }) => setSubs(data.items));
    api.get("/student/entitlements").then(({ data }) => setEnt(data));
  };
  useEffect(load, []);

  const subscribe = async (pid) => {
    setBusy(pid);
    try {
      await api.post("/student/subscribe", { package_id: pid });
      toast.success("Subscription activated!");
      load(); refresh();
    } catch (e) { toast.error(apiError(e)); } finally { setBusy(""); }
  };

  if (!pkgs || !ent) return <Loading />;
  const activePaid = subs.find((s) => s.status === "ACTIVE" && s.source !== "free");

  return (
    <div data-testid="subscription-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Subscription</h1>
      <p className="text-muted-foreground mt-1">Current plan: <span className="font-semibold text-foreground">{ent.package_name}</span></p>

      <div className="bg-card border rounded-xl p-6 mt-5">
        <h3 className="font-display font-bold mb-4">Your usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(ent.items).map(([k, v]) => (
            <div key={k} className="border rounded-lg p-4" data-testid={`usage-${k}`}>
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{k.replace("_", " ")}</p>
              <p className="font-mono-nums font-bold text-2xl mt-1">{v.unlimited ? "∞" : `${v.used}/${v.limit}`}</p>
              {!v.unlimited && <p className="text-xs text-muted-foreground">{v.remaining} left</p>}
            </div>
          ))}
        </div>
      </div>

      {activePaid && <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mt-4 text-sm text-emerald-800" data-testid="active-plan-banner">Your {activePaid.package_name} is active until {activePaid.end_date?.slice(0, 10)}.</div>}

      <h3 className="font-display font-bold text-lg mt-8 mb-4">Upgrade your plan</h3>
      <p className="text-xs text-muted-foreground mb-4">Payments are simulated in this demo — subscribing activates instantly.</p>
      <div className="grid md:grid-cols-3 gap-5">
        {pkgs.map((p) => (
          <div key={p.id} className={`bg-card border rounded-xl p-6 ${p.featured ? "ring-2 ring-[#D97706]" : ""}`} data-testid={`sub-package-${p.slug}`}>
            {p.featured && <Badge className="bg-[#D97706] text-white mb-2"><Star className="h-3 w-3 mr-1 fill-white" /> Popular</Badge>}
            <h4 className="font-display font-bold text-lg">{p.name}</h4>
            <p className="font-mono-nums font-extrabold text-3xl mt-2">৳{p.sale_price || p.regular_price}</p>
            <ul className="mt-4 space-y-2 text-sm">{(p.benefits || []).slice(0, 4).map((b) => <li key={b} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600 shrink-0" /> {b}</li>)}</ul>
            <Button disabled={busy === p.id} onClick={() => subscribe(p.id)} className="w-full mt-5 bg-slate-900 hover:bg-slate-800 text-white" data-testid={`subscribe-${p.slug}`}>
              {busy === p.id ? "Activating..." : "Subscribe"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
