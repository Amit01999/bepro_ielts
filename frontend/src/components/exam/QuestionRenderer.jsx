import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Flag } from "lucide-react";

// Schema-driven renderer for all supported question types.
export function QuestionRenderer({ question, value, onChange, flagged, onToggleFlag, showExplanation, explanation, correctAnswer, isCorrect }) {
  const q = question;
  const num = q.number;

  const renderInput = () => {
    switch (q.type) {
      case "mcq_single":
      case "tfng":
      case "ynng":
      case "matching":
        return (
          <RadioGroup value={value || ""} onValueChange={onChange} className="space-y-2" data-testid={`q-${num}-options`}>
            {(q.options || []).map((opt, i) => (
              <label key={i} className="flex items-center gap-3 border rounded-md px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors">
                <RadioGroupItem value={opt} id={`q${num}-${i}`} data-testid={`q-${num}-option-${i}`} />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </RadioGroup>
        );
      case "mcq_multi":
        return (
          <div className="space-y-2" data-testid={`q-${num}-options`}>
            {(q.options || []).map((opt, i) => {
              const arr = Array.isArray(value) ? value : [];
              const checked = arr.includes(opt);
              return (
                <label key={i} className="flex items-center gap-3 border rounded-md px-3 py-2.5 cursor-pointer hover:bg-muted/60">
                  <Checkbox
                    checked={checked}
                    data-testid={`q-${num}-option-${i}`}
                    onCheckedChange={(c) => {
                      const next = c ? [...arr, opt] : arr.filter((x) => x !== opt);
                      onChange(next);
                    }}
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              );
            })}
          </div>
        );
      case "essay":
      case "letter":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your response here..."
            className="min-h-[240px]"
            data-testid={`q-${num}-input`}
          />
        );
      default:
        // completion, short_answer, map_labeling, etc.
        return (
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.max_words ? `Answer (max ${q.max_words} word${q.max_words > 1 ? "s" : ""})` : "Type your answer"}
            data-testid={`q-${num}-input`}
          />
        );
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card" data-testid={`question-${num}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex gap-3">
          <span className="h-7 w-7 shrink-0 rounded-md bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
            {num}
          </span>
          <p className="text-sm leading-relaxed pt-0.5">{q.prompt}</p>
        </div>
        {onToggleFlag && (
          <button
            onClick={() => onToggleFlag(num)}
            data-testid={`q-${num}-flag`}
            className={`shrink-0 p-1.5 rounded-md border ${flagged ? "bg-[#FEF3C7] border-[#D97706] text-[#92400E]" : "border-border text-muted-foreground hover:bg-muted"}`}
            aria-label="Flag question"
          >
            <Flag className="h-4 w-4" />
          </button>
        )}
      </div>
      {renderInput()}
      {showExplanation && (
        <div className={`mt-3 text-sm rounded-md p-3 ${isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`} data-testid={`q-${num}-feedback`}>
          <p className="font-semibold">{isCorrect ? "Correct" : "Incorrect"}</p>
          {correctAnswer && <p>Answer: {Array.isArray(correctAnswer) ? correctAnswer.join(" / ") : correctAnswer}</p>}
          {explanation && <p className="mt-1 text-muted-foreground">{explanation}</p>}
        </div>
      )}
    </div>
  );
}
