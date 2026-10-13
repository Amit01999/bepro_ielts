import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Users, GraduationCap, ArrowLeft } from "lucide-react";

export default function Batches() {
  const [items, setItems] = useState(null);
  const [pkgs, setPkgs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: "", batch_code: "", teacher_id: "", package_id: "", capacity: 30, schedule: "" });

  const load = () => api.get("/admin/batches").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); api.get("/packages").then(({ data }) => setPkgs(data.items)); api.get("/admin/staff").then(({ data }) => setStaff(data.items.filter((s) => s.role === "teacher"))).catch(() => {}); }, []);

  const create = async () => {
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      if (!payload.teacher_id) delete payload.teacher_id;
      if (!payload.package_id) delete payload.package_id;
      await api.post("/admin/batches", payload); setOpen(false); load(); toast.success("Batch created");
      setForm({ name: "", batch_code: "", teacher_id: "", package_id: "", capacity: 30, schedule: "" });
    } catch (e) { toast.error(apiError(e)); }
  };

  const openDetail = async (id) => {
    const { data } = await api.get(`/admin/batches/${id}`);
    setDetail(data.batch); setStudents(data.students);
  };
  const addStudent = async (uid) => {
    try { await api.post(`/admin/batches/${detail.id}/add-student`, { user_id: uid }); toast.success("Student added"); openDetail(detail.id); }
    catch (e) { toast.error(apiError(e)); }
  };

  if (detail) {
    return (
      <div data-testid="batch-detail">
        <button onClick={() => setDetail(null)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to batches</button>
        <h1 className="text-2xl font-bold font-display">{detail.name}</h1>
        <p className="text-muted-foreground mt-1 font-mono-nums">{detail.batch_code}</p>
        <div className="bg-card border rounded-xl p-6 mt-5">
          <h3 className="font-display font-bold mb-4">Enrolled students ({students.length})</h3>
          {students.length === 0 ? <p className="text-sm text-muted-foreground">No students yet. Use "Add student" below.</p> : (
            <div className="space-y-2">{students.map((s) => (<div key={s.id} className="flex justify-between border-b last:border-0 py-2 text-sm"><span>{s.name} <span className="text-muted-foreground">({s.student_id})</span></span><span className="text-muted-foreground">{s.email}</span></div>))}</div>
          )}
          <div className="mt-4">
            <Label>Add student to batch (assigns batch package)</Label>
            <AddStudentPicker onPick={addStudent} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="admin-batches">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Batches</h1><p className="text-muted-foreground mt-1">Manage class batches and enrollment.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="create-batch-btn"><Plus className="h-4 w-4 mr-2" /> Create Batch</Button></DialogTrigger>
          <DialogContent data-testid="create-batch-dialog">
            <DialogHeader><DialogTitle>Create batch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Batch name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="batch-name" /></div>
              <div><Label>Batch code</Label><Input value={form.batch_code} onChange={(e) => setForm({ ...form, batch_code: e.target.value })} placeholder="IELTS-A-08" className="mt-1.5" data-testid="batch-code" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Teacher</Label>
                  <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{staff.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Package</Label>
                  <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="batch-package"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{pkgs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Schedule</Label><Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Sun/Tue/Thu 7-9 PM" className="mt-1.5" /></div>
            </div>
            <DialogFooter><Button onClick={create} className="bg-slate-900 text-white" data-testid="save-batch-btn">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!items ? <Loading /> : items.length === 0 ? <EmptyState title="No batches yet" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {items.map((b) => (
            <div key={b.id} onClick={() => openDetail(b.id)} className="bg-card border rounded-xl p-5 cursor-pointer hover:shadow-md" data-testid={`batch-card-${b.id}`}>
              <div className="flex items-center justify-between"><GraduationCap className="h-6 w-6 text-[#2563EB]" /><Badge className={b.status === "active" ? "bg-emerald-100 text-emerald-700" : ""}>{b.status}</Badge></div>
              <h3 className="font-display font-bold mt-3">{b.name}</h3>
              <p className="text-xs font-mono-nums text-muted-foreground">{b.batch_code}</p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {b.student_count}/{b.capacity}</span>
                {b.package_name && <Badge variant="outline">{b.package_name}</Badge>}
              </div>
              {b.teacher_name && <p className="text-xs text-muted-foreground mt-2">Teacher: {b.teacher_name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStudentPicker({ onPick }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  useEffect(() => { const t = setTimeout(() => { if (q.length >= 2) api.get("/admin/students", { params: { search: q, page_size: 5 } }).then(({ data }) => setRows(data.items)); else setRows([]); }, 300); return () => clearTimeout(t); }, [q]);
  return (
    <div className="mt-1.5">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student to add..." data-testid="batch-add-search" />
      {rows.length > 0 && <div className="border rounded-md mt-1 divide-y">{rows.map((s) => (<button key={s.id} onClick={() => onPick(s.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" data-testid={`batch-add-${s.id}`}>{s.name} <span className="text-muted-foreground">({s.student_id})</span></button>))}</div>}
    </div>
  );
}
