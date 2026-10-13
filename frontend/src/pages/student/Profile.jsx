import { useState } from "react";
import { useAuth } from "@/lib/auth";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);

  const changePw = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.post("/auth/change-password", pw); toast.success("Password changed"); setPw({ current_password: "", new_password: "" }); }
    catch (err) { toast.error(apiError(err)); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl" data-testid="profile-page">
      <h1 className="text-2xl sm:text-3xl font-bold font-display">Profile</h1>
      <div className="bg-card border rounded-xl p-6 mt-6 space-y-3">
        {[["Name", user.name], ["Email", user.email], ["Student ID", user.student_id], ["Target type", user.target_ielts_type === "general" ? "General Training" : "Academic"], ["Target band", user.target_band?.toFixed(1)]].map(([l, v]) => (
          <div key={l} className="flex justify-between border-b last:border-0 py-2 text-sm"><span className="text-muted-foreground">{l}</span><span className="font-semibold">{v || "—"}</span></div>
        ))}
      </div>
      <form onSubmit={changePw} className="bg-card border rounded-xl p-6 mt-6" data-testid="change-password-form">
        <h3 className="font-display font-bold mb-4">Change password</h3>
        <div className="space-y-4">
          <div><Label>Current password</Label><Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required className="mt-1.5" data-testid="current-password" /></div>
          <div><Label>New password</Label><Input type="password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={6} className="mt-1.5" data-testid="new-password" /></div>
        </div>
        <Button type="submit" disabled={busy} className="mt-5 bg-slate-900 text-white" data-testid="change-password-btn">Update password</Button>
      </form>
    </div>
  );
}
