import { useNavigate } from "react-router-dom";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

const CONTENT = {
  academic: {
    title: "IELTS Academic",
    lead: "For higher education and professional registration. Reading and Writing use academic texts, charts and essays.",
    points: ["Academic Reading with graphs, diagrams and dense passages", "Writing Task 1: describe visual data", "Writing Task 2: formal argumentative essay", "Shared Listening & Speaking with General Training"],
  },
  "general-training": {
    title: "IELTS General Training",
    lead: "For migration and work experience. Reading uses everyday texts and Writing Task 1 is a letter.",
    points: ["Reading from notices, adverts and workplace documents", "Writing Task 1: letter (formal / semi-formal / informal)", "Writing Task 2: essay on a general topic", "Shared Listening & Speaking with Academic"],
  },
  practice: {
    title: "Skill Practice",
    lead: "Targeted, self-paced practice by skill and question type — with instant answers, explanations and model responses.",
    points: ["Practice Listening, Reading, Writing & Speaking separately", "Immediate feedback and answer explanations", "Filter by topic, level and question type", "Retry and reveal answers in practice mode"],
  },
  "how-it-works": {
    title: "How It Works",
    lead: "A guided journey from free assessment to your target band.",
    points: ["Register free and take a free mock test", "Practice weak skills with instant feedback", "Get AI band estimates on Writing & Speaking", "Track progress with detailed analytics", "Upgrade or join a batch for unlimited access"],
  },
};

export default function InfoPage({ slug }) {
  const nav = useNavigate();
  const c = CONTENT[slug] || CONTENT.academic;
  return (
    <div data-testid={`info-${slug}`}>
      <PublicNav />
      <section className="max-w-4xl mx-auto px-5 py-16">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{c.title}</h1>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{c.lead}</p>
        <ul className="mt-8 space-y-4">
          {c.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> {p}</li>
          ))}
        </ul>
        <div className="mt-10 flex gap-3">
          <Button onClick={() => nav("/register")} className="bg-[#D97706] hover:bg-[#b45309] text-white" data-testid="info-register-btn">Start Free</Button>
          <Button variant="outline" onClick={() => nav("/pricing")}>View Pricing</Button>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
