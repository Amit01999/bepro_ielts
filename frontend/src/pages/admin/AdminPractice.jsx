import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function AdminPractice() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", skill: "reading", ielts_type: "academic", topic: "", level: "intermediate", estimated_minutes: 15, is_free: true, reveal_answers: true, instructions: "", passage: "", audio_url: "" });

  const load = () => api.get("/practice").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const save = async () => {
    try { await api.post("/practice", { ...form, estimated_minutes: Number(form.estimated_minutes), questions: [] }); setOpen(false); load(); toast.success("Practice set created (add questions via edit later)"); }
    catch (e) { toast.error(apiError(e)); }
  };
  return (
    <div data-testid="admin-practice">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Practice Sets</h1><p className="text-muted-foreground mt-1">Skill-based practice content.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="create-practice-btn"><Plus className="h-4 w-4 mr-2" /> Create Practice</Button></DialogTrigger>
          <DialogContent data-testid="create-practice-dialog">
            <DialogHeader><DialogTitle>Create practice set</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" data-testid="practice-title" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Skill</Label><Select value={form.skill} onValueChange={(v) => setForm({ ...form, skill: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{["listening", "reading", "writing", "speaking"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Level</Label><Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{["beginner", "intermediate", "advanced"].map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Minutes</Label><Input type="number" value={form.estimated_minutes} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })} className="mt-1.5" /></div>
              </div>
              <div><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="mt-1.5" /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_free} onCheckedChange={(v) => setForm({ ...form, is_free: v })} /> Free access</label>
            </div>
            <DialogFooter><Button onClick={save} className="bg-slate-900 text-white" data-testid="save-practice-btn">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {!items ? <Loading /> : items.length === 0 ? <EmptyState title="No practice sets" /> : (
        <div className="grid md:grid-cols-3 gap-5 mt-6">
          {items.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-5" data-testid={`admin-practice-${p.id}`}>
              <div className="flex items-center justify-between"><Badge variant="outline" className="capitalize">{p.skill}</Badge>{p.is_free && <Badge className="bg-emerald-100 text-emerald-700">Free</Badge>}</div>
              <h3 className="font-display font-bold mt-3">{p.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 capitalize">{p.level} · {p.questions?.length || 0} questions</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
