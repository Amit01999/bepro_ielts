import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { QuestionRenderer } from "@/components/exam/QuestionRenderer";
import { BandBadge } from "@/components/shared/BandBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function PracticeRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const [set, setSet] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { api.get(`/student/practice/${id}`).then(({ data }) => setSet(data)).catch((e) => { toast.error(apiError(e)); nav("/app/practice"); }); }, [id]);

  const submit = async () => {
    setSubmitting(true);
    try { const { data } = await api.post(`/student/practice/${id}/submit`, { answers }); setResult(data); window.scrollTo(0, 0); }
    catch (e) { toast.error(apiError(e)); } finally { setSubmitting(false); }
  };

  if (!set) return <Loading />;

  return (
    <div className="max-w-3xl mx-auto" data-testid="practice-runner">
      <button onClick={() => nav("/app/practice")} className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to practice</button>
      <h1 className="text-2xl font-bold font-display">{set.title}</h1>
      <p className="text-muted-foreground mt-1 capitalize">{set.skill} · {set.level}</p>
      {set.instructions && <p className="text-sm bg-muted rounded-md p-3 mt-3">{set.instructions}</p>}

      {result && (
        <div className="mt-5 bg-card border rounded-xl p-6 flex items-center gap-6" data-testid="practice-result">
          <BandBadge band={result.band} label="Est. band" size="lg" />
          <div>
            <p className="font-display font-bold text-xl">{result.raw} / {result.total} correct</p>
            <p className="text-sm text-muted-foreground">Estimated band based on scaled score. Review the feedback below.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setResult(null); setAnswers({}); }} data-testid="practice-retry"><RotateCcw className="h-4 w-4 mr-2" /> Retry</Button>
          </div>
        </div>
      )}

      {set.audio_url && (
        <audio controls src={set.audio_url} className="w-full mt-5" data-testid="practice-audio" />
      )}
      {set.passage && (
        <div className="mt-5 bg-card border rounded-xl p-5 max-h-72 overflow-y-auto text-sm leading-relaxed whitespace-pre-line" data-testid="practice-passage">{set.passage}</div>
      )}

      <div className="mt-6 space-y-4">
        {(set.questions || []).map((q) => {
          const res = result?.details?.find((d) => d.number === q.number);
          return (
            <QuestionRenderer key={q.id} question={q} value={answers[String(q.number)]}
              onChange={(v) => setAnswers((a) => ({ ...a, [String(q.number)]: v }))}
              showExplanation={!!result && result.reveal}
              explanation={result?.explanations?.[String(q.number)]}
              correctAnswer={res?.correct_answer} isCorrect={res?.is_correct} />
          );
        })}
      </div>

      {!result && (
        <Button onClick={submit} disabled={submitting} className="w-full mt-6 bg-[#D97706] hover:bg-[#b45309] text-white h-11" data-testid="practice-submit">
          {submitting ? "Checking..." : "Submit & check answers"}
        </Button>
      )}
    </div>
  );
}
