import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldAlert, Clock, ListChecks } from "lucide-react";

export default function ExamIntro() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.get("/student/exams").then(({ data }) => {
      const e = data.items.find((x) => x.id === examId);
      if (!e) { toast.error("Exam not found"); nav("/app/mock-tests"); } else setExam(e);
    });
  }, [examId]);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post(`/exams/${examId}/start`, { agreed: true });
      nav(`/app/exam/${data.attempt_id}`);
    } catch (e) { toast.error(apiError(e)); setStarting(false); }
  };

  if (!exam) return <Loading />;
  return (
    <div className="max-w-2xl mx-auto" data-testid="exam-intro">
      <div className="bg-card border rounded-xl p-8">
        <h1 className="text-2xl font-bold font-display">{exam.title}</h1>
        <p className="text-muted-foreground mt-1">{exam.ielts_type === "general" ? "General Training" : "Academic"} · {exam.kind} mock</p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="border rounded-lg p-4 flex items-center gap-3"><Clock className="h-5 w-5 text-[#2563EB]" /><div><p className="text-sm font-semibold">{exam.duration_minutes} minutes</p><p className="text-xs text-muted-foreground">Server-timed</p></div></div>
          <div className="border rounded-lg p-4 flex items-center gap-3"><ListChecks className="h-5 w-5 text-[#059669]" /><div><p className="text-sm font-semibold">{exam.question_count} questions</p><p className="text-xs text-muted-foreground">Auto-saved</p></div></div>
        </div>
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Examination rules</p>
            <ul className="list-disc pl-4 mt-2 space-y-1 text-amber-800">
              <li>The timer is controlled by the server. Refreshing will not reset it.</li>
              <li>Leaving the exam window may be logged as a violation and can auto-submit your exam.</li>
              <li>Your answers save automatically. Exiting submits your attempt.</li>
            </ul>
          </div>
        </div>
        {exam.instructions && <p className="text-sm mt-4 text-muted-foreground">{exam.instructions}</p>}
        <label className="flex items-center gap-3 mt-6 cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={setAgreed} data-testid="exam-agree-checkbox" />
          <span className="text-sm">I have read and understood the examination rules.</span>
        </label>
        <Button disabled={!agreed || starting} onClick={start} className="w-full mt-6 bg-[#D97706] hover:bg-[#b45309] text-white h-11" data-testid="exam-begin-btn">
          {starting ? "Starting..." : "Start Exam"}
        </Button>
      </div>
    </div>
  );
}
