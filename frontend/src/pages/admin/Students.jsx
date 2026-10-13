import { useEffect, useState } from "react";
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
import { Plus, Search, KeyRound } from "lucide-react";

export default function Students() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pkgs, setPkgs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", target_ielts_type: "academic", target_band: 7, package_id: "", batch_id: "" });
  const [created, setCreated] = useState(null);

  const load = () => api.get("/admin/students", { params: { search, page, page_size: 15 } }).then(({ data }) => setData(data)).catch(() => setData({ items: [], total: 0 }));
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [search, page]);
  useEffect(() => { api.get("/packages").then(({ data }) => setPkgs(data.items)); api.get("/admin/batches").then(({ data }) => setBatches(data.items)).catch(() => {}); }, []);

  const create = async () => {
    try {
      const payload = { ...form, target_band: Number(form.target_band) };
      if (!payload.package_id) delete payload.package_id;
      if (!payload.batch_id) delete payload.batch_id;
      const { data } = await api.post("/admin/students", payload);
      setCreated({ ...data.user, temp_password: data.temp_password });
      setForm({ name: "", email: "", phone: "", target_ielts_type: "academic", target_band: 7, package_id: "", batch_id: "" });
      load();
      toast.success("Student created");
    } catch (e) { toast.error(apiError(e)); }
  };

  const resetPw = async (id) => {
    try { const { data } = await api.post(`/admin/students/${id}/reset-password`); toast.success(`Temp password: ${data.temp_password}`); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-students">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Students</h1><p className="text-muted-foreground mt-1">{data?.total ?? 0} total students</p></div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreated(null); }}>
          <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="add-student-btn"><Plus className="h-4 w-4 mr-2" /> Add Student</Button></DialogTrigger>
          <DialogContent data-testid="add-student-dialog">
            <DialogHeader><DialogTitle>{created ? "Student created" : "Add new student"}</DialogTitle></DialogHeader>
            {created ? (
              <div className="space-y-3" data-testid="student-created-info">
                <p className="text-sm">Share these credentials with the student:</p>
                <div className="bg-muted rounded-md p-4 text-sm space-y-1">
                  <p><b>Student ID:</b> {created.student_id}</p>
                  <p><b>Email:</b> {created.email}</p>
                  <p><b>Temp password:</b> <span className="font-mono-nums">{created.temp_password}</span></p>
                </div>
                <Button onClick={() => setCreated(null)} variant="outline" className="w-full">Add another</Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="student-name" /></div>
                  <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" data-testid="student-email" /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5" /></div>
                  <div><Label>Target type</Label>
                    <Select value={form.target_ielts_type} onValueChange={(v) => setForm({ ...form, target_ielts_type: v })}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="academic">Academic</SelectItem><SelectItem value="general">General</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Package</Label>
                    <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                      <SelectTrigger className="mt-1.5" data-testid="student-package"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{pkgs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Batch</Label>
                    <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
                      <SelectTrigger className="mt-1.5" data-testid="student-batch"><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={create} className="bg-slate-900 text-white" data-testid="save-student-btn">Create student</Button></DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, email, ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" data-testid="student-search" />
      </div>

      <div className="bg-card border rounded-xl mt-5 overflow-hidden">
        {!data ? <Loading /> : data.items.length === 0 ? <EmptyState title="No students found" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Package</TableHead><TableHead>Tests</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.id} data-testid={`student-row-${s.id}`}>
                  <TableCell className="font-mono-nums text-xs">{s.student_id}</TableCell>
                  <TableCell><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></TableCell>
                  <TableCell><Badge variant="outline">{s.package_name || "Free"}</Badge></TableCell>
                  <TableCell className="font-mono-nums">{s.tests_taken}</TableCell>
                  <TableCell><Badge className={s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{s.status}</Badge></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => resetPw(s.id)} data-testid={`reset-pw-${s.id}`}><KeyRound className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {data && data.total > 15 && (
        <div className="flex justify-between items-center mt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={page * 15 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
