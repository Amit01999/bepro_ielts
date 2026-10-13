import { Check, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuestionNavigator({ questions, answers, flagged, current, onJump }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="question-navigator">
      {questions.map((q) => {
        const num = q.number;
        const answered = answers[String(num)] !== undefined && answers[String(num)] !== "" &&
          !(Array.isArray(answers[String(num)]) && answers[String(num)].length === 0);
        const isFlagged = flagged.includes(num);
        const isCurrent = current === num;
        return (
          <button
            key={num}
            onClick={() => onJump(num)}
            data-testid={`nav-question-${num}`}
            aria-label={`Question ${num}${answered ? " answered" : " unanswered"}${isFlagged ? " flagged" : ""}`}
            className={cn(
              "relative h-9 w-9 rounded-md border text-sm font-semibold flex items-center justify-center transition-all",
              isCurrent && "ring-2 ring-[#2563EB] ring-offset-1",
              isFlagged
                ? "bg-[#FEF3C7] border-[#D97706] text-[#92400E]"
                : answered
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-slate-50 border-border text-slate-500 hover:bg-slate-100"
            )}
          >
            {num}
            {answered && !isFlagged && <Check className="h-3 w-3 absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full p-[1px]" />}
            {isFlagged && <Flag className="h-3 w-3 absolute -top-1 -right-1 bg-[#D97706] text-white rounded-full p-[1px]" />}
          </button>
        );
      })}
    </div>
  );
}
