import { useEffect, useState } from "react";
import api, { apiError } from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function Settings() {
  const [s, setS] = useState(null);
  const load = () => api.get("/admin/settings").then(({ data }) => setS(data)).catch(() => setS({}));
  useEffect(() => { load(); }, []);

  const setFree = (k, v) => setS((x) => ({ ...x, free_plan: { ...x.free_plan, [k]: v } }));
  const setRules = (k, v) => setS((x) => ({ ...x, exam_rules: { ...x.exam_rules, [k]: v } }));
  const setAnti = (k, v) => setS((x) => ({ ...x, anti_cheat: { ...x.anti_cheat, [k]: v } }));

  const save = async () => {
    try {
      const data = {
        free_plan: Object.fromEntries(Object.entries(s.free_plan).map(([k, v]) => [k, typeof v === "boolean" ? v : Number(v)])),
        exam_rules: Object.fromEntries(Object.entries(s.exam_rules).map(([k, v]) => [k, Number(v)])),
        anti_cheat: { enabled: s.anti_cheat.enabled, warnings: Number(s.anti_cheat.warnings) },
        result_visibility: s.result_visibility,
      };
      await api.put("/admin/settings", { data }); toast.success("Settings saved");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!s) return <Loading />;
  const fp = s.free_plan || {}; const er = s.exam_rules || {}; const ac = s.anti_cheat || {};
  return (
    <div className="max-w-3xl" data-testid="admin-settings">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl sm:text-3xl font-bold font-display">System Settings</h1><p className="text-muted-foreground mt-1">Configure business rules without code changes.</p></div>
        <Button onClick={save} className="bg-slate-900 text-white" data-testid="save-settings-btn">Save changes</Button>
      </div>

      <div className="bg-card border rounded-xl p-6 mt-6">
        <h3 className="font-display font-bold mb-4">Free Plan Allowances</h3>
        <div className="grid grid-cols-2 gap-4">
          {[["full_mock_attempts", "Full mock attempts"], ["skill_mock_attempts", "Skill mock attempts"], ["practice_sets", "Practice sets"], ["ai_evaluations", "AI evaluations"]].map(([k, l]) => (
            <div key={k}><Label className="text-xs">{l}</Label><Input type="number" value={fp[k] ?? 0} onChange={(e) => setFree(k, e.target.value)} className="mt-1" data-testid={`free-${k}`} /></div>
          ))}
        </div>
        <div className="flex gap-6 mt-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={fp.notes_access ?? false} onCheckedChange={(v) => setFree("notes_access", v)} /> Notes access</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={fp.analytics_access ?? false} onCheckedChange={(v) => setFree("analytics_access", v)} /> Analytics access</label>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 mt-6">
        <h3 className="font-display font-bold mb-4">IELTS Exam Rules</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["listening_minutes", "Listening (min)"], ["reading_minutes", "Reading (min)"], ["writing_minutes", "Writing (min)"], ["autosave_interval", "Autosave (s)"]].map(([k, l]) => (
            <div key={k}><Label className="text-xs">{l}</Label><Input type="number" value={er[k] ?? 0} onChange={(e) => setRules(k, e.target.value)} className="mt-1" data-testid={`rule-${k}`} /></div>
          ))}
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6 mt-6">
        <h3 className="font-display font-bold mb-4">Exam Security (Anti-cheat)</h3>
        <label className="flex items-center gap-2 text-sm mb-4"><Switch checked={ac.enabled ?? true} onCheckedChange={(v) => setAnti("enabled", v)} data-testid="anti-cheat-enabled" /> Enable browser anti-cheat monitoring</label>
        <div className="max-w-xs"><Label className="text-xs">Warnings before auto-submit (0 = immediate)</Label><Input type="number" value={ac.warnings ?? 1} onChange={(e) => setAnti("warnings", e.target.value)} className="mt-1" data-testid="anti-cheat-warnings" /></div>
        <p className="text-xs text-muted-foreground mt-3">Browser controls cannot fully prevent app switching. Violations are logged and policies are configurable.</p>
      </div>
    </div>
  );
}
