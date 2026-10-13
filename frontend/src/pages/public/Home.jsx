import { useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { PublicNav, PublicFooter } from '@/components/layout/PublicNav';
import { Button } from '@/components/ui/button';
import { BandBadge } from '@/components/shared/BandBadge';
import {
  Headphones,
  BookOpen,
  PenLine,
  Mic,
  Sparkles,
  BarChart3,
  Timer,
  CheckCircle2,
  ArrowRight,
  Star,
  Target,
  Award,
  GraduationCap,
  TrendingUp,
} from 'lucide-react';
import './Home.css';

const MODULES = [
  {
    icon: Headphones,
    name: 'Listening',
    desc: '4 sections · 40 questions · realistic audio player',
    color: '#2563EB',
  },
  {
    icon: BookOpen,
    name: 'Reading',
    desc: 'Split-screen passages · highlight · 13 question types',
    color: '#4F46E5',
  },
  {
    icon: PenLine,
    name: 'Writing',
    desc: 'Task 1 & 2 editor · AI band feedback on 4 criteria',
    color: '#B45309',
  },
  {
    icon: Mic,
    name: 'Speaking',
    desc: 'Mic check · record · AI transcript & pronunciation',
    color: '#059669',
  },
];

const STEPS = [
  {
    n: '01',
    t: 'Assess & set target',
    d: 'Register free, take a free mock and set your target band.',
  },
  {
    n: '02',
    t: 'Practice by skill',
    d: 'Targeted practice sets with instant answers & explanations.',
  },
  {
    n: '03',
    t: 'Get AI feedback',
    d: 'Writing & speaking scored against IELTS-style criteria.',
  },
  {
    n: '04',
    t: 'Track to your band',
    d: 'Analytics reveal weak areas and recommend next steps.',
  },
];

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: i => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
};

// Decorative botanical linework does not affect page interactions.
function Botanical({ className = '' }) {
  return (
    <svg
      className={`forest-botanical ${className}`}
      viewBox="0 0 240 400"
      fill="none"
      aria-hidden="true"
    >
      <path d="M119 395C102 304 166 176 111 15" />
      <path d="M123 341C52 336 18 294 23 252C82 258 113 290 123 341ZM124 303C190 291 225 249 215 204C164 218 133 252 124 303ZM136 249C68 237 37 200 43 157C99 170 127 203 136 249ZM139 208C192 188 211 149 197 111C156 130 138 165 139 208ZM135 153C85 137 62 104 70 69C112 84 131 115 135 153ZM126 104C163 82 171 48 154 20C126 41 120 70 126 104ZM112 48C83 37 72 19 78 2C102 8 113 26 112 48Z" />
    </svg>
  );
}

export default function Home() {
  const nav = useNavigate();
  return (
    <MotionConfig reducedMotion="user">
      <div className="forest-home" data-testid="home-page">
        <PublicNav />

        <main>
          {/* Hero */}
          <section className="forest-hero relative overflow-hidden">
            <Botanical className="forest-hero-botanical" />
            <div className="forest-container forest-hero-grid">
              <div>
                <span className="forest-eyebrow forest-hero-eyebrow">
                  <span className="forest-live-dot" /> AI-Powered IELTS
                  Preparation
                </span>
                <h1 className="forest-hero-title">
                  Bridge the gap
                  <br />
                  to your{' '}
                  <em>
                    target
                    <br className="forest-heading-break" /> band.
                  </em>
                </h1>
                <p className="forest-hero-description">
                  Realistic Academic & General Training mock tests, skill
                  practice, and instant AI feedback on Writing and Speaking —
                  built to feel like the real computer-delivered exam.
                </p>
                <div className="forest-hero-actions">
                  <Button
                    size="lg"
                    onClick={() => nav('/register')}
                    className="forest-button forest-button-gold"
                    data-testid="hero-free-mock-btn"
                  >
                    Take a Free Mock Test{' '}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => nav('/pricing')}
                    className="forest-button forest-button-outline"
                    data-testid="hero-pricing-btn"
                  >
                    View Packages
                  </Button>
                </div>
                <div className="forest-hero-reassurance">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Free
                    plan included
                  </span>
                  <span className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-[#2563EB]" /> Server-timed
                    exams
                  </span>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="forest-hero-visual"
              >
                <div className="forest-photo-frame">
                  <img
                    src="https://images.pexels.com/photos/6549587/pexels-photo-6549587.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                    alt="Student preparing for IELTS"
                    className="forest-hero-photo"
                    fetchPriority="high"
                  />
                  <div className="forest-photo-caption">
                    <Target size={18} />
                    <span>
                      Small steps.
                      <br />
                      <strong>Extraordinary possibilities.</strong>
                    </span>
                  </div>
                </div>
                <div className="forest-ai-tag">
                  <Sparkles size={15} /> A little practice. A world of
                  possibility.
                </div>
                <div className="forest-band-preview">
                  <BandBadge band={7.5} size="md" testId="hero-band-badge" />
                  <div>
                    <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Overall Band
                    </p>
                    <p className="forest-band-title">
                      Your potential, in focus.
                    </p>
                    <p className="forest-preview-note">
                      Estimated result preview
                    </p>
                  </div>
                  <TrendingUp className="forest-band-trend" size={22} />
                </div>
                <p className="forest-visual-footnote">
                  ROOTED IN PRACTICE. BUILT FOR PROGRESS.
                </p>
              </motion.div>
            </div>
            <div className="forest-container forest-hero-bottom">
              <span>YOUR NEXT CHAPTER STARTS HERE</span>
              <span>
                IELTS Academic & General Training <ArrowRight size={14} />
              </span>
            </div>
          </section>

          {/* Stats */}
          <section className="forest-stats">
            <div className="forest-container forest-stats-grid">
              {[
                ['40+', 'Question types'],
                ['4', 'IELTS skills'],
                ['AI', 'Writing & Speaking'],
                ['0–9', 'Band scoring'],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display font-extrabold text-3xl md:text-4xl text-[#D97706]">
                    {v}
                  </p>
                  <p className="text-sm text-slate-300 mt-1">{l}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Modules */}
          <section className="forest-container forest-section">
            <div className="forest-section-heading">
              <div>
                <span className="forest-eyebrow">
                  <Award size={14} /> Room to grow, in every skill
                </span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Four skills.
                  <br />
                  <em>One realistic platform.</em>
                </h2>
              </div>
              <p className="mt-3 text-muted-foreground text-lg">
                Every module mirrors the real computer-delivered IELTS
                experience — timers, navigators and all.
              </p>
            </div>
            <div className="forest-modules">
              {MODULES.map((m, i) => (
                <motion.div
                  key={m.name}
                  custom={i}
                  variants={fade}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  className="forest-module"
                  data-testid={`module-${m.name.toLowerCase()}`}
                >
                  <div className="forest-module-top">
                    <div
                      className="forest-module-icon"
                      style={{ backgroundColor: m.color + '14' }}
                    >
                      <m.icon
                        className="h-6 w-6"
                        strokeWidth={1.5}
                        style={{ color: m.color }}
                      />
                    </div>
                    <span>0{i + 1}</span>
                  </div>
                  <h3 className="font-display font-bold text-xl">{m.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {m.desc}
                  </p>
                  <div className="forest-module-bottom">
                    <span>BUILT FOR THE REAL EXAM</span>
                    <span style={{ backgroundColor: m.color }} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="forest-journey">
            <div className="forest-container forest-section">
              <span className="forest-eyebrow">A clear path forward</span>
              <h2 className="mt-3">
                How Bepro <em>works.</em>
              </h2>
              <div className="forest-steps">
                {STEPS.map(s => (
                  <div
                    key={s.n}
                    className="forest-step"
                    data-testid={`step-${s.n}`}
                  >
                    <div className="forest-step-marker">
                      <span>{s.n}</span>
                      <div />
                    </div>
                    <h3 className="font-display font-bold text-lg mt-3">
                      {s.t}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">{s.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* AI + Analytics */}
          <section className="forest-container forest-section forest-feedback">
            <div>
              <span className="forest-eyebrow">
                <Sparkles size={14} /> Powered by AI
              </span>
              <h2 className="mt-3">
                Insight that helps
                <br />
                you <em>move forward.</em>
              </h2>
              <h3 className="forest-feedback-subtitle">
                Instant, criterion-based feedback
              </h3>
              <p className="mt-4 text-muted-foreground text-lg">
                Your Writing and Speaking responses are evaluated against the
                four official IELTS criteria with detailed strengths, weaknesses
                and corrected examples.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Task Response · Coherence · Lexical Resource · Grammar',
                  'Band estimate per criterion (0–9)',
                  'Model answers & recommended exercises',
                  'Optional teacher review & override',
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />{' '}
                    {t}
                  </li>
                ))}
              </ul>
              <p className="forest-disclaimer">
                AI-generated band estimates and feedback are for IELTS
                preparation purposes and are not official IELTS examination
                results.
              </p>
            </div>
            <div className="forest-analytics-surround">
              <Botanical className="forest-analytics-botanical" />
              <div className="forest-analytics-card">
                <div className="forest-analytics-header">
                  <BarChart3 size={20} />
                  <div>
                    <h4>Performance Analytics</h4>
                    <p>A little clearer. A little closer.</p>
                  </div>
                  <span>PREVIEW</span>
                </div>
                <div className="forest-analytics-summary">
                  <div>
                    <span className="forest-eyebrow">Your target band</span>
                    <p>
                      7.5<span> / 9.0</span>
                    </p>
                  </div>
                  <span>
                    <TrendingUp size={14} /> Room to grow
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['Listening', 7.0],
                    ['Reading', 6.5],
                    ['Writing', 6.0],
                    ['Speaking', 7.5],
                  ].map(([s, b]) => (
                    <div key={s} className="forest-skill-score">
                      <div className="forest-score-track" aria-hidden="true">
                        <div style={{ height: `${(b / 9) * 100}%` }} />
                      </div>
                      <BandBadge band={b} size="sm" />
                      <p className="text-[11px] mt-1 text-muted-foreground">
                        {s}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="forest-progress-label">
                  <span>Progress to your target</span>
                  <strong>72%</strong>
                </div>
                <div
                  className="forest-progress"
                  role="progressbar"
                  aria-label="Progress to target band"
                  aria-valuenow={72}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: '72%' }} />
                </div>
                <p className="forest-progress-caption">
                  72% of the way to your 7.5 target band
                </p>
              </div>
              <p className="forest-analytics-caption">
                <TrendingUp size={14} /> Meaningful feedback. Measurable growth.
              </p>
            </div>
          </section>

          {/* Testimonials */}
          <section className="forest-testimonials">
            <div className="forest-container forest-section">
              <span className="forest-eyebrow">
                Different journeys. Shared ambition.
              </span>
              <h2 className="mt-3">
                Trusted by <em>ambitious candidates.</em>
              </h2>
              <div className="mt-10 grid md:grid-cols-3 gap-6">
                {[
                  [
                    'I improved from 6.0 to 7.5 in six weeks.',
                    'Ayesha R.',
                    'Academic · Band 7.5',
                  ],
                  [
                    'The AI writing feedback pinpointed exactly what to fix.',
                    'Daniel K.',
                    'General · Band 7.0',
                  ],
                  [
                    'The mock tests feel identical to the real exam.',
                    'Meng L.',
                    'Academic · Band 8.0',
                  ],
                ].map(([q, n, b]) => (
                  <div key={n} className="forest-testimonial">
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-[#D97706] text-[#D97706]"
                        />
                      ))}
                    </div>
                    <blockquote>&ldquo;{q}&rdquo;</blockquote>
                    <div className="forest-testimonial-person">
                      <span className="forest-avatar" aria-hidden="true">
                        {n
                          .split(' ')
                          .map(part => part[0])
                          .join('')}
                      </span>
                      <div>
                        <p>{n}</p>
                        <span>{b}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="forest-final-cta">
            <Botanical className="forest-cta-botanical" />
            <div className="forest-container">
              <span className="forest-cta-icon">
                <GraduationCap size={24} strokeWidth={1.4} />
              </span>
              <span className="forest-eyebrow">
                Great things begin with a first step
              </span>
              <h2>
                Start your free
                <br />
                mock test <em>today.</em>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
                No card required. Experience realistic exams and AI feedback in
                minutes.
              </p>
              <Button
                size="lg"
                onClick={() => nav('/register')}
                className="forest-button forest-button-green"
                data-testid="cta-register-btn"
              >
                Create free account <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <span className="forest-cta-note">
                <CheckCircle2 size={14} /> Your next chapter is waiting.
              </span>
            </div>
          </section>
        </main>
        <PublicFooter />
      </div>
    </MotionConfig>
  );
}
