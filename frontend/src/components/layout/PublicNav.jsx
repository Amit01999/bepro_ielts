import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Menu, X, GraduationCap } from 'lucide-react';

const LINKS = [
  { to: '/academic', label: 'Academic' },
  { to: '/general-training', label: 'General Training' },
  { to: '/practice-info', label: 'Practice' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/how-it-works', label: 'How It Works' },
];

export function PublicNav() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b"
      data-testid="public-nav"
    >
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2"
          data-testid="brand-logo"
        >
          <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-[#D97706]" />
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight">
            Bepro
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              data-testid={`nav-${l.label.toLowerCase().replace(/ /g, '-')}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button
              onClick={() => nav(user.role === 'student' ? '/app' : '/admin')}
              className="bg-slate-900 hover:bg-slate-800 text-white"
              data-testid="nav-dashboard-btn"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                data-testid="nav-login"
              >
                Log in
              </Link>
              <Button
                onClick={() => nav('/register')}
                className="bg-[#D97706] hover:bg-[#b45309] text-white"
                data-testid="nav-register"
              >
                Start Free
              </Button>
            </>
          )}
        </div>
        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          data-testid="mobile-menu-toggle"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div
          className="md:hidden border-t px-5 py-4 space-y-3 bg-white"
          data-testid="mobile-menu"
        >
          {LINKS.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium text-slate-700"
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => nav('/login')}
            >
              Log in
            </Button>
            <Button
              className="flex-1 bg-[#D97706] text-white"
              onClick={() => nav('/register')}
            >
              Start Free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer
      className="bg-slate-900 text-slate-300 mt-24"
      data-testid="public-footer"
    >
      <div className="max-w-7xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-5 w-5 text-[#D97706]" />
            <span className="font-display font-extrabold text-white">
              BePro
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Your path to your target band. IELTS Academic & General Training
            preparation, practice and AI-powered feedback.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 text-sm">Prepare</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <Link to="/academic">Academic</Link>
            </li>
            <li>
              <Link to="/general-training">General Training</Link>
            </li>
            <li>
              <Link to="/practice-info">Practice</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 text-sm">Platform</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>
              <Link to="/pricing">Pricing</Link>
            </li>
            <li>
              <Link to="/how-it-works">How It Works</Link>
            </li>
            <li>
              <Link to="/register">Free Mock Test</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3 text-sm">Legal</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            AI-generated band estimates and feedback are for IELTS preparation
            only and are not official IELTS results. Not affiliated with British
            Council, IDP or Cambridge.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-500">
        © 2026 B IELTS. All rights reserved.
      </div>
    </footer>
  );
}
