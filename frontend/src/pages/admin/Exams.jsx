import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Send, KeyRound, FileUp } from "lucide-react";

export default function Exams() {
  const [items, setItems] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ielts_type: "academic", kind: "reading", duration_minutes: 60, is_free: false });
  const [assign, setAssign] = useState({ exam_id: "", exam_code: "", batch_id: "", access_pin: "", attempt_limit: 1 });
  const nav = useNavigate();

  const load = () => {
    api.get("/exams").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
    api.get("/exam-assignments").then(({ data }) => setAssignments(data.items)).catch(() => {});
    api.get("/admin/batches").then(({ data }) => setBatches(data.items)).catch(() => {});
  };
  useEffect(load, []);

  const create = async () => {
    try { const { data } = await api.post("/exams", { ...form, duration_minutes: Number(form.duration_minutes), sections: [] }); toast.success("Exam created — add sections"); nav(`/admin/exams/${data.id}/build`); }
    catch (e) { toast.error(apiError(e)); }
  };
  const publish = async (id) => {
    try { await api.post(`/exams/${id}/publish`); toast.success("Exam published"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };
  const createAssignment = async () => {
    try { const payload = { ...assign, attempt_limit: Number(assign.attempt_limit) }; if (!payload.batch_id) delete payload.batch_id; if (!payload.access_pin) delete payload.access_pin;
      await api.post("/exam-assignments", payload); setAssignOpen(false); load(); toast.success("Exam ID created"); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-exams">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Exams</h1><p className="text-muted-foreground mt-1">Build, publish and assign mock tests.</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => nav("/admin/exams/sources")} data-testid="source-documents-btn"><FileUp className="h-4 w-4 mr-2" /> Upload PDF</Button>
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild><Button variant="outline" data-testid="create-examid-btn"><KeyRound className="h-4 w-4 mr-2" /> Create Exam ID</Button></DialogTrigger>
            <DialogContent data-testid="create-examid-dialog">
              <DialogHeader><DialogTitle>Create scheduled Exam ID</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Exam</Label>
                  <Select value={assign.exam_id} onValueChange={(v) => setAssign({ ...assign, exam_id: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="assign-exam"><SelectValue placeholder="Select exam" /></SelectTrigger>
                    <SelectContent>{(items || []).filter((e) => e.status === "published").map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Exam ID code</Label><Input value={assign.exam_code} onChange={(e) => setAssign({ ...assign, exam_code: e.target.value.toUpperCase() })} placeholder="IELTS-MOCK-0926-A7" className="mt-1.5" data-testid="assign-code" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Batch</Label>
                    <Select value={assign.batch_id} onValueChange={(v) => setAssign({ ...assign, batch_id: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Any" /></SelectTrigger>
                      <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Access PIN</Label><Input value={assign.access_pin} onChange={(e) => setAssign({ ...assign, access_pin: e.target.value })} className="mt-1.5" /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={createAssignment} className="bg-slate-900 text-white" data-testid="save-examid-btn">Create Exam ID</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="create-exam-btn"><Plus className="h-4 w-4 mr-2" /> Create Exam</Button></DialogTrigger>
            <DialogContent data-testid="create-exam-dialog">
              <DialogHeader><DialogTitle>Create exam</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" data-testid="exam-title" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.ielts_type} onValueChange={(v) => setForm({ ...form, ielts_type: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="academic">Academic</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select>
                  </div>
                  <div><Label>Kind</Label>
                    <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}><SelectTrigger className="mt-1.5" data-testid="exam-kind"><SelectValue /></SelectTrigger>
                      <SelectContent>{["full", "listening", "reading", "writing", "speaking"].map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div><Label>Minutes</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} className="mt-1.5" /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={create} className="bg-slate-900 text-white" data-testid="save-exam-btn">Create & build</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!items ? <Loading /> : (
        <div className="bg-card border rounded-xl mt-6 overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Kind</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id} data-testid={`exam-row-${e.id}`}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="capitalize">{e.ielts_type}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{e.kind}</Badge></TableCell>
                  <TableCell><Badge className={e.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>{e.status}</Badge></TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => nav(`/admin/exams/${e.id}/build`)} data-testid={`build-${e.id}`}>Build</Button>
                    {e.status !== "published" && <Button size="sm" className="bg-[#059669] text-white" onClick={() => publish(e.id)} data-testid={`publish-${e.id}`}><Send className="h-3.5 w-3.5 mr-1" /> Publish</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {assignments.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display font-bold text-lg mb-3">Scheduled Exam IDs</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {assignments.map((a) => (
              <div key={a.id} className="bg-card border rounded-lg p-4" data-testid={`assignment-${a.id}`}>
                <p className="font-mono-nums font-bold">{a.exam_code}</p>
                <p className="text-xs text-muted-foreground mt-1">Attempts: {a.attempt_limit} {a.access_pin ? "· PIN protected" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
