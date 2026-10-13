import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { BandBadge } from "@/components/shared/BandBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, Circle, Sparkles, Loader2 } from "lucide-react";

const CRIT_LABELS = {
  task_response: "Task Response", coherence_cohesion: "Coherence & Cohesion",
  lexical_resource: "Lexical Resource", grammatical_range: "Grammar Range & Accuracy",
  fluency_coherence: "Fluency & Coherence", pronunciation: "Pronunciation",
};

function SpeakingReplay({ attemptId, rec }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/attempts/${attemptId}/speaking/audio/${rec.question_number}`); setSrc(`data:${data.mime};base64,${data.b64}`); }
    catch {} finally { setLoading(false); }
  };
  return (
    <div className="flex items-center gap-3 border rounded-md p-2" data-testid={`replay-${rec.question_number}`}>
      <span className="text-xs font-semibold w-20">Part {rec.part} · Q{rec.question_number}</span>
      {src ? <audio controls src={src} className="h-8 flex-1" /> : <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Play recording"}</Button>}
    </div>
  );
}

export default function ResultDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [r, setR] = useState(null);
  const [poll, setPoll] = useState(0);

  useEffect(() => {
    let active = true;
    api.get(`/student/results/${id}`).then(({ data }) => { if (active) setR(data); });
    return () => { active = false; };
  }, [id, poll]);

  useEffect(() => {
    if (r && r.status === "EVALUATING") {
      const t = setTimeout(() => setPoll((p) => p + 1), 4000);
      return () => clearTimeout(t);
    }
  }, [r]);

  if (!r) return <Loading />;
  const skills = r.skills || {};

  return (
    <div className="max-w-4xl mx-auto" data-testid="result-detail">
      <button onClick={() => nav("/app/results")} className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to results</button>

      <div className="bg-slate-900 text-white rounded-xl p-8 flex flex-col md:flex-row items-center gap-8">
        <BandBadge band={r.overall_band} label="Overall band" size="lg" />
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold font-display">{r.exam_title}</h1>
          <p className="text-slate-300 mt-1">{r.ielts_type === "general" ? "General Training" : "Academic"} · {r.kind} mock</p>
          {r.status === "EVALUATING" && <p className="text-sm text-amber-300 mt-2 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> AI evaluation in progress...</p>}
          <p className="text-xs text-slate-400 mt-3">Estimated practice result — not an official IELTS score.</p>
        </div>
      </div>

      {/* Per-skill */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {["listening", "reading", "writing", "speaking"].filter((s) => skills[s]).map((s) => (
          <div key={s} className="bg-card border rounded-xl p-5 text-center" data-testid={`result-skill-${s}`}>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground capitalize">{s}</p>
            <div className="flex justify-center my-3"><BandBadge band={skills[s].band} size="md" /></div>
            {skills[s].raw != null && <p className="text-sm text-muted-foreground">{skills[s].raw}/{skills[s].total} correct</p>}
            {skills[s].status && skills[s].band == null && <Badge variant="outline" className="text-xs">{skills[s].status}</Badge>}
          </div>
        ))}
      </div>

      {/* Objective answer review */}
      {["listening", "reading"].filter((s) => skills[s]?.details).map((s) => (
        <div key={s} className="bg-card border rounded-xl p-6 mt-6" data-testid={`answer-review-${s}`}>
          <h3 className="font-display font-bold text-lg mb-4 capitalize">{s} — answer review</h3>
          <div className="space-y-2">
            {skills[s].details.map((d) => (
              <div key={d.number} className="flex items-start gap-3 py-2 border-b last:border-0 text-sm">
                {d.is_correct ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : d.answered ? <XCircle className="h-5 w-5 text-red-500 shrink-0" /> : <Circle className="h-5 w-5 text-slate-300 shrink-0" />}
                <div className="flex-1">
                  <p><span className="font-semibold">Q{d.number}.</span> Your answer: <span className={d.is_correct ? "text-emerald-700" : "text-red-600"}>{d.user_answer || "(blank)"}</span></p>
                  {!d.is_correct && <p className="text-muted-foreground text-xs mt-0.5">Correct: {Array.isArray(d.correct_answer) ? d.correct_answer.join(" / ") : d.correct_answer}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Writing AI feedback */}
      {(r.writing_evaluations || []).map((ev) => (
        <div key={ev.id} className="bg-card border rounded-xl p-6 mt-6" data-testid={`writing-feedback-${ev.question_number}`}>
          <div className="flex items-center gap-2 mb-4"><Sparkles className="h-5 w-5 text-[#7C3AED]" /><h3 className="font-display font-bold text-lg">Writing Task {ev.question_number} — AI feedback</h3></div>
          {ev.status === "FAILED" ? (
            <p className="text-sm text-red-600">Evaluation failed and was not scored. A teacher can review this response manually.</p>
          ) : ev.status !== "COMPLETED" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Evaluation {ev.status.toLowerCase()}...</p>
          ) : ev.raw ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(ev.raw.criteria || {}).map(([k, v]) => (
                  <div key={k} className="border rounded-lg p-3 text-center">
                    <p className="font-mono-nums font-bold text-xl">{v.band?.toFixed(1)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{CRIT_LABELS[k] || k}</p>
                  </div>
                ))}
              </div>
              {ev.raw.strengths?.length > 0 && <div><p className="font-semibold text-sm text-emerald-700">Strengths</p><ul className="list-disc pl-5 text-sm text-muted-foreground mt-1">{ev.raw.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {ev.raw.weaknesses?.length > 0 && <div><p className="font-semibold text-sm text-red-600">Areas to improve</p><ul className="list-disc pl-5 text-sm text-muted-foreground mt-1">{ev.raw.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {ev.raw.corrected_examples?.length > 0 && (
                <div><p className="font-semibold text-sm">Corrected examples</p>
                  {ev.raw.corrected_examples.map((c, i) => (
                    <div key={i} className="text-sm mt-2 bg-muted rounded-md p-3"><p className="text-red-600 line-through">{c.original}</p><p className="text-emerald-700 mt-1">{c.improved}</p></div>
                  ))}
                </div>
              )}
              {ev.review && <div className="bg-blue-50 border border-blue-200 rounded-md p-3"><p className="text-sm font-semibold text-blue-800">Teacher review · Band {ev.review.overall_band?.toFixed(1)}</p><p className="text-sm text-blue-700 mt-1">{ev.review.comments}</p></div>}
            </div>
          ) : <p className="text-sm text-red-600">Evaluation failed. Please contact support.</p>}
        </div>
      ))}

      {/* Speaking AI feedback */}
      {r.speaking_evaluation && (
        <div className="bg-card border rounded-xl p-6 mt-6" data-testid="speaking-feedback">
          <div className="flex items-center gap-2 mb-4"><Sparkles className="h-5 w-5 text-[#7C3AED]" /><h3 className="font-display font-bold text-lg">Speaking — AI feedback</h3></div>
          {r.speaking_evaluation.status === "FAILED" ? (
            <p className="text-sm text-red-600">Evaluation failed and was not scored. A teacher can review this recording manually.</p>
          ) : r.speaking_evaluation.status !== "COMPLETED" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Evaluation {r.speaking_evaluation.status?.toLowerCase()}...</p>
          ) : r.speaking_evaluation.raw ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(r.speaking_evaluation.raw.criteria || {}).map(([k, v]) => (
                  <div key={k} className="border rounded-lg p-3 text-center"><p className="font-mono-nums font-bold text-xl">{v.band?.toFixed(1)}</p><p className="text-[11px] text-muted-foreground mt-1">{CRIT_LABELS[k] || k}</p></div>
                ))}
              </div>
              {(r.skills?.speaking?.recordings || []).length > 0 && (
                <div><p className="font-semibold text-sm mb-2">Your recordings</p><div className="space-y-2">
                  {r.skills.speaking.recordings.map((rec) => <SpeakingReplay key={rec.question_number} attemptId={r.attempt_id} rec={rec} />)}
                </div></div>
              )}
              {r.speaking_evaluation.transcript && <div><p className="font-semibold text-sm">Transcript</p><p className="text-sm text-muted-foreground mt-1 bg-muted rounded-md p-3 whitespace-pre-line max-h-40 overflow-y-auto">{r.speaking_evaluation.transcript}</p></div>}
              {r.speaking_evaluation.raw.strengths?.length > 0 && <div><p className="font-semibold text-sm text-emerald-700">Strengths</p><ul className="list-disc pl-5 text-sm text-muted-foreground mt-1">{r.speaking_evaluation.raw.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {r.speaking_evaluation.raw.weaknesses?.length > 0 && <div><p className="font-semibold text-sm text-red-600">Areas to improve</p><ul className="list-disc pl-5 text-sm text-muted-foreground mt-1">{r.speaking_evaluation.raw.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
              {r.speaking_evaluation.review && <div className="bg-blue-50 border border-blue-200 rounded-md p-3"><p className="text-sm font-semibold text-blue-800">Teacher review · Band {r.speaking_evaluation.review.overall_band?.toFixed(1)}</p><p className="text-sm text-blue-700 mt-1">{r.speaking_evaluation.review.comments}</p></div>}
            </div>
          ) : <p className="text-sm text-red-600">Evaluation failed.</p>}
        </div>
      )}

      {r.violations?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mt-6" data-testid="result-violations">
          <p className="font-semibold text-red-700 text-sm">Exam violations recorded ({r.violations.length})</p>
          <ul className="text-xs text-red-600 mt-2 space-y-1">{r.violations.map((v, i) => <li key={i}>{v.type} · {v.timestamp?.slice(11, 19)}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
