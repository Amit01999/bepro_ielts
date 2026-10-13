import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function EnterExamId() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  const verify = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { const { data } = await api.post("/exams/enter", { exam_code: code, access_pin: pin || undefined }); setInfo(data); }
    catch (err) { setError(apiError(err)); } finally { setBusy(false); }
  };
  const begin = () => nav(`/app/exam-intro/${info.exam_id}`);

  return (
    <div className="max-w-md mx-auto" data-testid="enter-exam-page">
      <div className="bg-card border rounded-xl p-8">
        <div className="h-12 w-12 rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-4"><KeyRound className="h-6 w-6 text-[#D97706]" /></div>
        <h1 className="text-2xl font-bold font-display">Enter Exam ID</h1>
        <p className="text-muted-foreground mt-1 text-sm">Enter the Exam ID provided by your teacher to access a scheduled exam.</p>
        {info ? (
          <div className="mt-6" data-testid="exam-found">
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4">
              <p className="font-semibold text-emerald-800">{info.title}</p>
              <p className="text-sm text-emerald-700 mt-1">Duration: {info.duration_minutes} minutes</p>
            </div>
            <Button onClick={begin} className="w-full mt-4 bg-[#D97706] hover:bg-[#b45309] text-white" data-testid="proceed-exam-btn">Proceed to instructions</Button>
          </div>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-4">
            {error && <div className="text-sm bg-red-50 text-red-700 rounded-md px-3 py-2" data-testid="examid-error">{error}</div>}
            <div><Label>Exam ID</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="IELTS-MOCK-0926-A7" required className="mt-1.5" data-testid="examid-input" /></div>
            <div><Label>Access PIN (if required)</Label><Input value={pin} onChange={(e) => setPin(e.target.value)} className="mt-1.5" data-testid="examid-pin" /></div>
            <Button type="submit" disabled={busy} className="w-full bg-slate-900 text-white" data-testid="verify-examid-btn">{busy ? "Verifying..." : "Verify Exam ID"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
