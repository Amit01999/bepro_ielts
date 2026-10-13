import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading, EmptyState } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, UserCog } from "lucide-react";

export default function Staff() {
  const [items, setItems] = useState(null);
  const [perms, setPerms] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher", permissions: [] });

  const load = () => api.get("/admin/staff").then(({ data }) => setItems(data.items)).catch(() => setItems([]));
  useEffect(() => { load(); api.get("/admin/permissions").then(({ data }) => setPerms(data.all)).catch(() => {}); }, []);

  const togglePerm = (p) => setForm((f) => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p] }));
  const create = async () => {
    try { await api.post("/admin/staff", form); setOpen(false); load(); toast.success("Staff member created"); setForm({ name: "", email: "", password: "", role: "teacher", permissions: [] }); }
    catch (e) { toast.error(apiError(e)); }
  };

  return (
    <div data-testid="admin-staff">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">Staff & Roles</h1><p className="text-muted-foreground mt-1">Teachers, examiners, content managers and sub-admins.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-slate-900 text-white" data-testid="add-staff-btn"><Plus className="h-4 w-4 mr-2" /> Add Staff</Button></DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="add-staff-dialog">
            <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="staff-name" /></div>
                <div><Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="staff-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem><SelectItem value="examiner">Examiner</SelectItem>
                      <SelectItem value="content_manager">Content Manager</SelectItem><SelectItem value="sub_admin">Sub Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" data-testid="staff-email" /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1.5" data-testid="staff-password" /></div>
              {form.role === "sub_admin" && (
                <div>
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {perms.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={form.permissions.includes(p)} onCheckedChange={() => togglePerm(p)} data-testid={`perm-${p}`} /> {p}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter><Button onClick={create} className="bg-slate-900 text-white" data-testid="save-staff-btn">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!items ? <Loading /> : items.length === 0 ? <EmptyState title="No staff yet" /> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {items.map((s) => (
            <div key={s.id} className="bg-card border rounded-xl p-5" data-testid={`staff-card-${s.id}`}>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center"><UserCog className="h-5 w-5 text-[#2563EB]" /></div>
                <div><p className="font-semibold">{s.name}</p><p className="text-xs text-muted-foreground">{s.email}</p></div>
              </div>
              <Badge variant="outline" className="mt-3 capitalize">{s.role.replace("_", " ")}</Badge>
              {s.permissions?.length > 0 && <p className="text-xs text-muted-foreground mt-2">{s.permissions.length} permissions</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
