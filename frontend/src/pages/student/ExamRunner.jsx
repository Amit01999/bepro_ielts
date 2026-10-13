import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionNavigator } from "@/components/exam/QuestionNavigator";
import { QuestionRenderer } from "@/components/exam/QuestionRenderer";
import { SpeakingStage } from "@/components/exam/SpeakingStage";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { GraduationCap, LogOut, Wifi, WifiOff, CheckCircle2 } from "lucide-react";

export default function ExamRunner() {
  const { attemptId } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState(null); // {exam, remaining, section}
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [current, setCurrent] = useState(1);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [online, setOnline] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showExit, setShowExit] = useState(false);
  const [warning, setWarning] = useState(null);
  const saveTimer = useRef(null);
  const dirty = useRef({});
  const submittedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/attempts/${attemptId}`);
      if (data.expired && data.result_id) {
        submittedRef.current = true;
        toast.error("Time's up — your exam was submitted automatically.");
        nav(`/app/results/${data.result_id}`);
        return;
      }
      setState({ exam: data.exam, remaining: data.remaining_seconds });
      setAnswers(data.attempt.answers || {});
      setSectionIdx(data.attempt.section_index || 0);
    } catch (e) { toast.error(apiError(e)); nav("/app/mock-tests"); }
  }, [attemptId]);

  useEffect(() => { load(); }, [load]);

  // Periodically resync the server-authoritative remaining time, since the on-screen
  // timer otherwise only ticks locally between loads and can drift in a backgrounded tab.
  useEffect(() => {
    const id = setInterval(async () => {
      if (submittedRef.current) return;
      try {
        const { data } = await api.get(`/attempts/${attemptId}`);
        if (data.expired && data.result_id) {
          submittedRef.current = true;
          toast.error("Time's up — your exam was submitted automatically.");
          nav(`/app/results/${data.result_id}`);
          return;
        }
        setState((s) => (s ? { ...s, remaining: data.remaining_seconds } : s));
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [attemptId, nav]);

  // online/offline
  useEffect(() => {
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // anti-cheat
  useEffect(() => {
    const onViolation = async (type) => {
      if (submittedRef.current) return;
      try {
        const { data } = await api.post(`/attempts/${attemptId}/violation`, { type, question_number: current });
        if (data.action === "auto_submit") { submittedRef.current = true; toast.error(data.message); nav(`/app/results/${data.result_id}`); }
        else if (data.action === "warn") setWarning(data.message);
      } catch {}
    };
    const vis = () => { if (document.hidden) onViolation("visibility_hidden"); };
    const blur = () => onViolation("window_blur");
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("blur", blur);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("blur", blur); };
  }, [attemptId, current]);

  const flush = async () => {
    if (Object.keys(dirty.current).length === 0) return;
    const payload = { ...dirty.current };
    dirty.current = {};
    try { await api.post(`/attempts/${attemptId}/answers`, { answers: payload, section_index: sectionIdx }); }
    catch { dirty.current = { ...payload, ...dirty.current }; }
  };

  const setAnswer = (num, value) => {
    setAnswers((a) => ({ ...a, [String(num)]: value }));
    dirty.current[String(num)] = value;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 1200);
  };

  const toggleFlag = (num) => setFlagged((f) => f.includes(num) ? f.filter((x) => x !== num) : [...f, num]);

  const doSubmit = async (auto = false) => {
    if (submittedRef.current) return;
    setSubmitting(true);
    await flush();
    try {
      const { data } = await api.post(`/attempts/${attemptId}/submit`);
      submittedRef.current = true;
      if (!auto) toast.success("Exam submitted!");
      nav(`/app/results/${data.result_id}`);
    } catch (e) { toast.error(apiError(e)); setSubmitting(false); }
  };

  if (!state) return <div className="min-h-screen flex items-center justify-center"><Loading label="Preparing your exam..." /></div>;

  const sections = state.exam.sections || [];
  const section = sections[sectionIdx] || sections[0];
  const skill = section.skill;
  const questions = section.questions || [];
  const isWriting = skill === "writing";

  const wordCount = (v) => (v || "").trim().split(/\s+/).filter(Boolean).length;

  const QuestionsPanel = (
    <div className="space-y-4" data-testid="questions-panel">
      {questions.map((q) => (
        <div key={q.id} id={`q-${q.number}`}>
          {isWriting ? (
            <div className="border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">Task {q.number} {q.number === 1 ? "(min 150 words)" : "(min 250 words)"}</span>
                <span className="text-xs font-mono-nums text-muted-foreground" data-testid={`word-count-${q.number}`}>{wordCount(answers[String(q.number)])} words</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{q.prompt}</p>
              <QuestionRenderer question={q} value={answers[String(q.number)]} onChange={(v) => setAnswer(q.number, v)} />
            </div>
          ) : (
            <QuestionRenderer question={q} value={answers[String(q.number)]} onChange={(v) => setAnswer(q.number, v)}
              flagged={flagged.includes(q.number)} onToggleFlag={toggleFlag} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="exam-runner">
      {/* Exam header */}
      <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-[#D97706]" />
          <div>
            <p className="font-display font-bold text-sm leading-none">{state.exam.title}</p>
            {sections.length > 1 ? (
              <div className="flex items-center gap-1.5 mt-1" data-testid="mock-progress">
                {sections.map((s, i) => (
                  <span key={s.id} className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${i === sectionIdx ? "bg-[#2563EB] text-white" : i < sectionIdx ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{s.skill}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{skill} · Section {sectionIdx + 1} of {sections.length}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 text-xs ${online ? "text-emerald-600" : "text-red-600"}`}>{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}</span>
          <ExamTimer remainingSeconds={state.remaining} onExpire={() => doSubmit(true)} />
          <Button variant="outline" size="sm" onClick={() => setShowExit(true)} data-testid="exit-exam-btn"><LogOut className="h-4 w-4 mr-1" /> Exit</Button>
        </div>
      </header>

      {!online && <div className="bg-red-600 text-white text-sm text-center py-2" data-testid="offline-banner">Connection lost — your local answers are being preserved. Reconnecting...</div>}

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {skill === "speaking" ? (
          <div className="overflow-y-auto h-[calc(100vh-64px)]">
            <SpeakingStage attemptId={attemptId} questions={questions} submitting={submitting}
              onComplete={() => { if (sectionIdx < sections.length - 1) { flush(); setSectionIdx((i) => i + 1); setCurrent(1); window.scrollTo(0, 0); } else { doSubmit(false); } }} />
          </div>
        ) : skill === "reading" ? (
          <div className="grid lg:grid-cols-2 h-[calc(100vh-64px-56px)]">
            <div className="overflow-y-auto p-5 md:p-8 border-r" data-testid="reading-passage">
              {(section.passages || []).map((p) => (
                <div key={p.id} className="prose max-w-none">
                  <h3 className="font-display font-bold text-lg">{p.title}</h3>
                  <p className="text-sm leading-7 whitespace-pre-line mt-3">{p.body}</p>
                </div>
              ))}
            </div>
            <div className="overflow-y-auto p-5 md:p-8">{QuestionsPanel}</div>
          </div>
        ) : skill === "listening" ? (
          <div className="max-w-3xl mx-auto p-5 md:p-8 overflow-y-auto h-[calc(100vh-64px-56px)]">
            {section.audio_url && (
              <div className="bg-card border rounded-xl p-4 mb-6 sticky top-0" data-testid="listening-audio">
                <p className="text-sm font-semibold mb-2">{section.instructions}</p>
                <audio controls src={section.audio_url} className="w-full" />
              </div>
            )}
            {QuestionsPanel}
          </div>
        ) : isWriting ? (
          <div className="grid lg:grid-cols-5 h-[calc(100vh-64px-56px)]">
            <div className="lg:col-span-2 overflow-y-auto p-5 md:p-8 border-r bg-muted/30" data-testid="writing-prompt">
              <p className="text-sm font-semibold mb-3">{section.instructions}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">AI feedback is provided for preparation and is not an official IELTS result. No grammar suggestions are given during the exam.</div>
            </div>
            <div className="lg:col-span-3 overflow-y-auto p-5 md:p-8">{QuestionsPanel}</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-5 md:p-8 overflow-y-auto h-[calc(100vh-64px-56px)]">{QuestionsPanel}</div>
        )}
      </div>

      {/* Bottom navigator */}
      {skill !== "speaking" && (
      <footer className="border-t bg-white px-4 md:px-6 py-3 flex items-center justify-between gap-4 sticky bottom-0 z-40">
        {!isWriting ? (
          <div className="flex-1 overflow-x-auto"><QuestionNavigator questions={questions} answers={answers} flagged={flagged} current={current} onJump={(n) => { setCurrent(n); document.getElementById(`q-${n}`)?.scrollIntoView({ behavior: "smooth" }); }} /></div>
        ) : <div className="flex-1 text-sm text-muted-foreground">Complete both tasks before submitting.</div>}
        <div className="flex items-center gap-2 shrink-0">
          {sectionIdx < sections.length - 1 && (
            <Button variant="outline" onClick={() => { flush(); setSectionIdx((i) => i + 1); setCurrent(1); window.scrollTo(0, 0); }} data-testid="next-section-btn">Next section</Button>
          )}
          <Button onClick={() => setShowExit("submit")} disabled={submitting} className="bg-[#059669] hover:bg-[#047857] text-white" data-testid="submit-exam-btn">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Submit
          </Button>
        </div>
      </footer>
      )}

      {/* Exit / submit dialog */}
      <AlertDialog open={!!showExit} onOpenChange={(o) => !o && setShowExit(false)}>
        <AlertDialogContent data-testid="exit-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{showExit === "submit" ? "Submit your exam?" : "Exit exam?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {showExit === "submit"
                ? "Your answers will be submitted for scoring. This action cannot be undone."
                : "If you exit now, your exam will be submitted and this attempt cannot be resumed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="dialog-continue">Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSubmit(false)} disabled={submitting} className="bg-[#059669] hover:bg-[#047857]" data-testid="dialog-submit">Submit & Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Anti-cheat warning */}
      <AlertDialog open={!!warning} onOpenChange={(o) => !o && setWarning(null)}>
        <AlertDialogContent data-testid="violation-warning">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Warning</AlertDialogTitle>
            <AlertDialogDescription>{warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogAction onClick={() => setWarning(null)}>I understand</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
