import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { apiError } from "@/lib/api";
import { Loading } from "@/components/shared/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Send, Eye, Sparkles, Undo2 } from "lucide-react";

const QTYPES = [["mcq_single", "Multiple choice (single)"], ["mcq_multi", "Multiple choice (multi)"], ["tfng", "True/False/Not Given"], ["ynng", "Yes/No/Not Given"], ["completion", "Completion / gap fill"], ["short_answer", "Short answer"], ["matching", "Matching"], ["essay", "Essay (Writing)"], ["letter", "Letter (Writing)"]];

export default function ExamBuilder() {
  const { examId } = useParams();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- nav is a stable useNavigate() reference
  useEffect(() => { api.get(`/exams/${examId}`).then(({ data }) => setExam(data)).catch((e) => { toast.error(apiError(e)); nav("/admin/exams"); }); }, [examId]);

  const addSection = () => setExam((x) => ({ ...x, sections: [...(x.sections || []), { id: crypto.randomUUID(), skill: x.kind === "full" ? "listening" : x.kind, order: x.sections.length, instructions: "", audio_url: "", passages: [], questions: [] }] }));
  const updateSection = (i, patch) => setExam((x) => { const s = [...x.sections]; s[i] = { ...s[i], ...patch }; return { ...x, sections: s }; });
  const removeSection = (i) => setExam((x) => ({ ...x, sections: x.sections.filter((_, idx) => idx !== i) }));

  const addPassage = (si) => updateSection(si, { passages: [...(exam.sections[si].passages || []), { id: crypto.randomUUID(), title: "Passage", body: "", order: 0 }] });
  const updatePassage = (si, pi, patch) => { const p = [...exam.sections[si].passages]; p[pi] = { ...p[pi], ...patch }; updateSection(si, { passages: p }); };

  const nextNum = (si) => (exam.sections[si].questions?.length ? Math.max(...exam.sections[si].questions.map((q) => q.number)) + 1 : 1);
  const addQuestion = (si) => { const s = exam.sections[si]; updateSection(si, { questions: [...(s.questions || []), { id: crypto.randomUUID(), number: nextNum(si), skill: s.skill, ielts_type: exam.ielts_type, type: s.skill === "writing" ? "essay" : "tfng", prompt: "", options: s.skill === "writing" ? [] : ["True", "False", "Not Given"], accepted_answers: [], explanation: "" }] }); };
  const updateQuestion = (si, qi, patch) => { const q = [...exam.sections[si].questions]; q[qi] = { ...q[qi], ...patch }; updateSection(si, { questions: q }); };
  const removeQuestion = (si, qi) => updateSection(si, { questions: exam.sections[si].questions.filter((_, idx) => idx !== qi) });

  const save = async (publish = false) => {
    try {
      const payload = { title: exam.title, ielts_type: exam.ielts_type, kind: exam.kind, description: exam.description || "", duration_minutes: exam.duration_minutes, is_free: exam.is_free, packages_allowed: exam.packages_allowed || [], ai_evaluation: exam.ai_evaluation ?? true, instructions: exam.instructions || "", sections: exam.sections, status: exam.status, source_document_id: exam.source_document_id ?? null };
      await api.put(`/exams/${examId}`, payload);
      if (publish) { await api.post(`/exams/${examId}/publish`); toast.success("Published!"); nav("/admin/exams"); return; }
      toast.success("Saved");
    } catch (e) { toast.error(apiError(e)); }
  };

  const unpublish = async () => {
    try { await api.delete(`/exams/${examId}`); toast.success("Unpublished"); setExam((x) => ({ ...x, status: "archived" })); }
    catch (e) { toast.error(apiError(e)); }
  };

  const viewSourcePdf = async () => {
    try {
      const { data } = await api.get(`/admin/source-documents/${exam.source_document_id}/preview-url`);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(apiError(e)); }
  };

  if (!exam) return <Loading />;

  return (
    <div data-testid="exam-builder">
      <button onClick={() => nav("/admin/exams")} className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back to exams</button>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold font-display">{exam.title}</h1><p className="text-muted-foreground mt-1 capitalize">{exam.ielts_type} · {exam.kind} · {exam.duration_minutes} min</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false)} data-testid="save-exam"><Save className="h-4 w-4 mr-2" /> Save draft</Button>
          {exam.status === "published" ? (
            <Button variant="outline" onClick={unpublish} data-testid="unpublish-exam"><Undo2 className="h-4 w-4 mr-2" /> Unpublish</Button>
          ) : (
            <Button className="bg-[#059669] text-white" onClick={() => save(true)} data-testid="publish-exam"><Send className="h-4 w-4 mr-2" /> Publish</Button>
          )}
        </div>
      </div>

      {exam.source_document_id && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 flex items-center justify-between flex-wrap gap-3" data-testid="source-pdf-banner">
          <p className="text-sm text-amber-800 flex items-center gap-2"><Sparkles className="h-4 w-4 shrink-0" /> Extracted from an uploaded PDF — review every question carefully before publishing.</p>
          <Button size="sm" variant="outline" onClick={viewSourcePdf} data-testid="view-source-pdf"><Eye className="h-3.5 w-3.5 mr-1" /> View source PDF</Button>
        </div>
      )}

      <div className="bg-card border rounded-xl p-5 mt-5 grid md:grid-cols-2 gap-4">
        <div><Label>Title</Label><Input value={exam.title} onChange={(e) => setExam({ ...exam, title: e.target.value })} className="mt-1.5" data-testid="exam-title-input" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Type</Label>
            <Select value={exam.ielts_type} onValueChange={(v) => setExam({ ...exam, ielts_type: v })}><SelectTrigger className="mt-1.5" data-testid="exam-ielts-type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="academic">Academic</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select>
          </div>
          <div><Label>Kind</Label>
            <Select value={exam.kind} onValueChange={(v) => setExam({ ...exam, kind: v })}><SelectTrigger className="mt-1.5" data-testid="exam-kind-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["full", "listening", "reading", "writing", "speaking"].map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>Minutes</Label><Input type="number" value={exam.duration_minutes} onChange={(e) => setExam({ ...exam, duration_minutes: Number(e.target.value) })} className="mt-1.5" data-testid="exam-duration-input" /></div>
        </div>
        <div><Label>Instructions</Label><Textarea value={exam.instructions || ""} onChange={(e) => setExam({ ...exam, instructions: e.target.value })} className="mt-1.5" data-testid="exam-instructions" /></div>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={exam.is_free} onCheckedChange={(v) => setExam({ ...exam, is_free: v })} data-testid="exam-free-toggle" /> Free (no subscription required)</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={exam.ai_evaluation ?? true} onCheckedChange={(v) => setExam({ ...exam, ai_evaluation: v })} /> AI evaluation for Writing/Speaking</label>
        </div>
      </div>

      {(exam.sections || []).map((sec, si) => (
        <div key={sec.id} className="bg-card border rounded-xl p-5 mt-5" data-testid={`section-${si}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Badge className="bg-slate-900 text-white">Section {si + 1}</Badge>
              <Select value={sec.skill} onValueChange={(v) => updateSection(si, { skill: v })}>
                <SelectTrigger className="w-40" data-testid={`section-skill-${si}`}><SelectValue /></SelectTrigger>
                <SelectContent>{["listening", "reading", "writing", "speaking"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeSection(si)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
          <div className="mt-3"><Label>Section instructions</Label><Input value={sec.instructions} onChange={(e) => updateSection(si, { instructions: e.target.value })} className="mt-1.5" /></div>
          {sec.skill === "listening" && <div className="mt-3"><Label>Audio URL</Label><Input value={sec.audio_url || ""} onChange={(e) => updateSection(si, { audio_url: e.target.value })} placeholder="https://.../audio.mp3" className="mt-1.5" data-testid={`section-audio-${si}`} /></div>}

          {sec.skill === "reading" && (
            <div className="mt-3">
              <div className="flex items-center justify-between"><Label>Passages</Label><Button size="sm" variant="outline" onClick={() => addPassage(si)}><Plus className="h-3.5 w-3.5 mr-1" /> Add passage</Button></div>
              {(sec.passages || []).map((p, pi) => (
                <div key={p.id} className="border rounded-md p-3 mt-2">
                  <Input value={p.title} onChange={(e) => updatePassage(si, pi, { title: e.target.value })} placeholder="Passage title" className="mb-2" />
                  <Textarea value={p.body} onChange={(e) => updatePassage(si, pi, { body: e.target.value })} placeholder="Passage text..." className="min-h-24" data-testid={`passage-body-${si}-${pi}`} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2"><Label>Questions ({sec.questions?.length || 0})</Label><Button size="sm" variant="outline" onClick={() => addQuestion(si)} data-testid={`add-question-${si}`}><Plus className="h-3.5 w-3.5 mr-1" /> Add question</Button></div>
            <div className="space-y-3">
              {(sec.questions || []).map((q, qi) => (
                <div key={q.id} className="border rounded-md p-3" data-testid={`question-editor-${si}-${qi}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-6 w-6 rounded bg-slate-900 text-white text-xs flex items-center justify-center">{q.number}</span>
                    <Select value={q.type} onValueChange={(v) => updateQuestion(si, qi, { type: v, options: v === "tfng" ? ["True", "False", "Not Given"] : v === "ynng" ? ["Yes", "No", "Not Given"] : q.options })}>
                      <SelectTrigger className="w-56 h-8" data-testid={`qtype-${si}-${qi}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{QTYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => removeQuestion(si, qi)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                  <Textarea value={q.prompt} onChange={(e) => updateQuestion(si, qi, { prompt: e.target.value })} placeholder="Question prompt..." className="mb-2 min-h-16" data-testid={`qprompt-${si}-${qi}`} />
                  {["mcq_single", "mcq_multi"].includes(q.type) && (
                    <Input value={(q.options || []).join(" | ")} onChange={(e) => updateQuestion(si, qi, { options: e.target.value.split("|").map((x) => x.trim()) })} placeholder="Options separated by |" className="mb-2" data-testid={`qoptions-${si}-${qi}`} />
                  )}
                  {!["essay", "letter"].includes(q.type) && (
                    <Input value={(q.accepted_answers || []).join(", ")} onChange={(e) => updateQuestion(si, qi, { accepted_answers: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Accepted answers (comma-separated, use / for variants)" className="mb-2" data-testid={`qanswers-${si}-${qi}`} />
                  )}
                  <Input value={q.explanation || ""} onChange={(e) => updateQuestion(si, qi, { explanation: e.target.value })} placeholder="Explanation (optional)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addSection} className="mt-5 w-full border-dashed" data-testid="add-section-btn"><Plus className="h-4 w-4 mr-2" /> Add section</Button>
    </div>
  );
}
