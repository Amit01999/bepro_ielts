import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Package as PackageIcon } from "lucide-react";

const EMPTY = {
  name: "", description: "", regular_price: 1000, sale_price: 0, currency: "BDT", active: true, featured: false, is_free: false, display_order: 1,
  benefits: "", entitlements: { full_mock_attempts: 5, skill_mock_attempts: 15, practice_sets: 20, ai_evaluations: 10, notes_access: true, analytics_access: true, unlimited: false, validity_days: 30 },
};

export default function Packages() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/admin/packages").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const setEnt = (k, v) => setForm((f) => ({ ...f, entitlements: { ...f.entitlements, [k]: v } }));

  const save = async () => {
    try {
      const payload = { ...form, regular_price: Number(form.regular_price), sale_price: Number(form.sale_price) || null,
        benefits: form.benefits.split("\n").map((b) => b.trim()).filter(Boolean),
        entitlements: Object.fromEntries(Object.entries(form.entitlements).map(([k, v]) => [k, typeof v === "boolean" ? v : Number(v)])) };
      await api.post("/admin/packages", payload); setOpen(false); setForm(EMPTY); load(); toast.success("Package created");
    } catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-packages">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Packages</h1><p className="text-muted-foreground mt-1">Subscription packages and entitlements.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="create-package-btn"><Plus className="h-4 w-4 mr-2" /> Create Package</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="create-package-dialog">
            <DialogHeader><DialogTitle>Create package</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="package-name" /></div>
                <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Regular price</Label><Input type="number" value={form.regular_price} onChange={(e) => setForm({ ...form, regular_price: e.target.value })} className="mt-1.5" data-testid="package-price" /></div>
                <div><Label>Sale price</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="mt-1.5" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" /></div>
              <div><Label>Benefits (one per line)</Label><Textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className="mt-1.5" placeholder="20 full mocks&#10;Unlimited practice" /></div>
              <div className="flex gap-6"><label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /> Featured</label></div>
              <div className="border rounded-lg p-4">
                <p className="font-semibold text-sm mb-3">Entitlements (use -1 for unlimited)</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["full_mock_attempts", "Full mocks"], ["skill_mock_attempts", "Skill mocks"], ["practice_sets", "Practice sets"], ["ai_evaluations", "AI evaluations"], ["validity_days", "Validity (days)"]].map(([k, l]) => (
                    <div key={k}><Label className="text-xs">{l}</Label><Input type="number" value={form.entitlements[k]} onChange={(e) => setEnt(k, e.target.value)} className="mt-1" data-testid={`ent-${k}`} /></div>
                  ))}
                </div>
                <div className="flex gap-6 mt-3">
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.entitlements.unlimited} onCheckedChange={(v) => setEnt("unlimited", v)} /> Unlimited flag</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.entitlements.notes_access} onCheckedChange={(v) => setEnt("notes_access", v)} /> Notes</label>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={form.entitlements.analytics_access} onCheckedChange={(v) => setEnt("analytics_access", v)} /> Analytics</label>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} className="bg-slate-900 text-white" data-testid="save-package-btn">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!items ? <Loading /> : items.length === 0 ? <EmptyState title="No packages yet" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {items.map((p) => (
            <div key={p.id} className={`bg-card border rounded-xl p-5 ${p.featured ? "ring-2 ring-[#D97706]" : ""}`} data-testid={`package-card-${p.id}`}>
              <div className="flex items-center justify-between"><PackageIcon className="h-6 w-6 text-[#2563EB]" />{!p.active && <Badge variant="outline">Inactive</Badge>}</div>
              <h3 className="font-display font-bold mt-3">{p.name}</h3>
              <p className="font-mono-nums font-bold text-2xl mt-1">৳{p.sale_price || p.regular_price}</p>
              <div className="text-xs text-muted-foreground mt-3 space-y-1">
                <p>Full mocks: {p.entitlements?.full_mock_attempts === -1 ? "∞" : p.entitlements?.full_mock_attempts}</p>
                <p>AI evals: {p.entitlements?.ai_evaluations === -1 ? "∞" : p.entitlements?.ai_evaluations}</p>
                <p>Validity: {p.entitlements?.validity_days} days</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
