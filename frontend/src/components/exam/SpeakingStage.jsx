import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Mic, Square, CheckCircle2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { fmtTime } from "@/lib/utils";
import { toast } from "sonner";

// Speaking exam stage: device check + per-question record/upload with prep & speaking timers.
export function SpeakingStage({ attemptId, questions, onComplete, submitting }) {
  const [checked, setChecked] = useState(false);
  const [level, setLevel] = useState(0);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle, prep, recording, uploading, done
  const [countdown, setCountdown] = useState(0);
  const [statuses, setStatuses] = useState({}); // qnum -> uploaded|failed
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  const q = questions[idx];

  useEffect(() => () => cleanup(), []);
  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const startDeviceCheck = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevel(Math.min(100, Math.round((data.reduce((a, b) => a + b, 0) / data.length) * 1.5)));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setChecked(true);
      toast.success("Microphone ready");
    } catch {
      toast.error("Microphone permission is required for the Speaking test.");
    }
  };

  const beginQuestion = () => {
    const prep = q.prep_seconds || 0;
    if (prep > 0) {
      setPhase("prep");
      setCountdown(prep);
      timerRef.current = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); startRecording(); return 0; } return c - 1; }), 1000);
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "" });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => uploadRecording();
    rec.start();
    setPhase("recording");
    const dur = q.speak_seconds || 60;
    setCountdown(dur);
    timerRef.current = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); stopRecording(); return 0; } return c - 1; }), 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const uploadRecording = async (retry = 0) => {
    setPhase("uploading");
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, `q${q.number}.webm`);
    fd.append("question_number", q.number);
    fd.append("part", q.part || "1");
    try {
      await api.post(`/attempts/${attemptId}/speaking/upload`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 });
      setStatuses((s) => ({ ...s, [q.number]: "uploaded" }));
      setPhase("done");
    } catch (e) {
      if (retry < 1) { toast.message("Upload failed — retrying..."); return uploadRecording(retry + 1); }
      setStatuses((s) => ({ ...s, [q.number]: "failed" }));
      setPhase("done");
      toast.error("Recording upload failed. You can re-record this question.");
    }
  };

  const next = () => {
    if (idx < questions.length - 1) { setIdx(idx + 1); setPhase("idle"); setCountdown(0); }
  };

  if (!checked) {
    return (
      <div className="max-w-lg mx-auto p-6" data-testid="speaking-device-check">
        <div className="bg-card border rounded-xl p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-4"><Mic className="h-7 w-7 text-[#7C3AED]" /></div>
          <h2 className="font-display font-bold text-xl">Microphone Device Check</h2>
          <p className="text-sm text-muted-foreground mt-2">We'll request microphone access and check your input level before the Speaking test begins.</p>
          <Button onClick={startDeviceCheck} className="mt-6 bg-[#7C3AED] hover:bg-[#6d28d9] text-white" data-testid="start-device-check-btn">Run microphone check</Button>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
            {["Microphone permission", "Audio input level", "Recording support", "Network status"].map((t) => (
              <div key={t} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> {t}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const allDone = questions.every((qq) => statuses[qq.number]);
  return (
    <div className="max-w-2xl mx-auto p-6" data-testid="speaking-stage">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wider font-semibold text-[#7C3AED]">Part {q.part} · Question {idx + 1} of {questions.length}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Mic level</span>
          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-[#7C3AED] transition-all" style={{ width: `${level}%` }} /></div>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-6">
        {q.part === "2" && <p className="text-xs font-semibold text-[#D97706] mb-2">Cue card — you have {q.prep_seconds}s to prepare, then {q.speak_seconds}s to speak.</p>}
        <p className="text-base leading-relaxed">{q.prompt}</p>

        <div className="mt-6 flex flex-col items-center">
          {phase === "idle" && (
            <Button onClick={beginQuestion} className="bg-[#7C3AED] hover:bg-[#6d28d9] text-white" data-testid={`speaking-begin-${q.number}`}>
              <Mic className="h-4 w-4 mr-2" /> {q.part === "2" ? "Start preparation" : "Start recording"}
            </Button>
          )}
          {phase === "prep" && (
            <div className="text-center" data-testid="speaking-prep"><p className="text-sm text-muted-foreground">Preparation time</p><p className="font-mono-nums font-bold text-4xl text-[#D97706]">{fmtTime(countdown)}</p></div>
          )}
          {phase === "recording" && (
            <div className="text-center" data-testid="speaking-recording">
              <div className="flex items-center gap-2 text-red-600 font-semibold mb-2"><span className="h-3 w-3 rounded-full bg-red-600 animate-pulse" /> Recording</div>
              <p className="font-mono-nums font-bold text-4xl">{fmtTime(countdown)}</p>
              <Button onClick={stopRecording} variant="outline" className="mt-3" data-testid={`speaking-stop-${q.number}`}><Square className="h-4 w-4 mr-2" /> Stop</Button>
            </div>
          )}
          {phase === "uploading" && (<div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Uploading & transcribing...</div>)}
          {phase === "done" && (
            <div className="text-center">
              {statuses[q.number] === "uploaded"
                ? <p className="flex items-center gap-2 text-emerald-600 font-semibold"><CheckCircle2 className="h-5 w-5" /> Answer recorded</p>
                : <p className="flex items-center gap-2 text-red-600 font-semibold"><AlertTriangle className="h-5 w-5" /> Upload failed</p>}
              <div className="flex gap-2 justify-center mt-3">
                <Button variant="outline" size="sm" onClick={() => { setPhase("idle"); }} data-testid={`speaking-rerecord-${q.number}`}>Re-record</Button>
                {idx < questions.length - 1 && <Button size="sm" onClick={next} className="bg-slate-900 text-white" data-testid={`speaking-next-${q.number}`}>Next question <ArrowRight className="h-4 w-4 ml-1" /></Button>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <div className="flex gap-2">
          {questions.map((qq) => (
            <span key={qq.number} className={`h-2.5 w-2.5 rounded-full ${statuses[qq.number] === "uploaded" ? "bg-emerald-500" : statuses[qq.number] === "failed" ? "bg-red-500" : "bg-slate-300"}`} />
          ))}
        </div>
        <Button disabled={!allDone || submitting} onClick={onComplete} className="bg-[#059669] hover:bg-[#047857] text-white" data-testid="speaking-submit-btn">
          {submitting ? "Submitting..." : "Submit Speaking"}
        </Button>
      </div>
    </div>
  );
}
