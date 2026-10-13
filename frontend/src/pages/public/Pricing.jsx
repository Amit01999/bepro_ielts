import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/States";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Check, Star } from "lucide-react";

export default function Pricing() {
  const [pkgs, setPkgs] = useState(null);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    api.get("/packages").then(({ data }) => setPkgs(data.items)).catch(() => setPkgs([]));
  }, []);

  const cta = (p) => {
    if (!user) return nav("/register");
    if (user.role === "student") return nav("/app/subscription");
    return nav("/admin/packages");
  };

  return (
    <div data-testid="pricing-page">
      <PublicNav />
      <section className="max-w-7xl mx-auto px-5 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Simple, transparent pricing</h1>
        <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">Start free. Upgrade when you're ready for more mocks, unlimited practice and AI evaluations.</p>
      </section>
      <section className="max-w-7xl mx-auto px-5 pb-10">
        {!pkgs ? <Loading /> : (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="bg-card border rounded-xl p-7" data-testid="pricing-free">
              <h3 className="font-display font-bold text-xl">Free</h3>
              <p className="font-mono-nums font-extrabold text-4xl mt-3">৳0</p>
              <p className="text-sm text-muted-foreground mt-1">Forever</p>
              <ul className="mt-6 space-y-3 text-sm">
                {["1 full mock test", "3 skill mocks", "10 practice sets", "3 AI evaluations", "Study notes & analytics"].map((f) => (
                  <li key={f} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Button variant="outline" className="w-full mt-7" onClick={() => nav("/register")} data-testid="pricing-free-cta">Start Free</Button>
            </div>
            {pkgs.map((p) => (
              <div key={p.id} className={`bg-card border rounded-xl p-7 relative ${p.featured ? "ring-2 ring-[#D97706] shadow-lg" : ""}`} data-testid={`pricing-${p.slug}`}>
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#D97706] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3 fill-white" /> Most Popular
                  </span>
                )}
                <h3 className="font-display font-bold text-xl">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-mono-nums font-extrabold text-4xl">৳{p.sale_price || p.regular_price}</span>
                  {p.sale_price && <span className="text-muted-foreground line-through text-sm">৳{p.regular_price}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{p.entitlements?.validity_days} days validity</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {(p.benefits || []).map((f) => (<li key={f} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600 shrink-0" /> {f}</li>))}
                </ul>
                <Button className={`w-full mt-7 ${p.featured ? "bg-[#D97706] hover:bg-[#b45309]" : "bg-slate-900 hover:bg-slate-800"} text-white`} onClick={() => cta(p)} data-testid={`pricing-${p.slug}-cta`}>
                  Choose {p.name}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <PublicFooter />
    </div>
  );
}
