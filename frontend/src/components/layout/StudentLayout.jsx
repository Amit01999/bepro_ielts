import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Headphones,
  PenLine,
  Mic,
  KeyRound,
  Trophy,
  BarChart3,
  Sparkles,
  CreditCard,
  Bell,
  User,
  LogOut,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/practice', label: 'Practice', icon: BookOpen },
  { to: '/app/mock-tests', label: 'Mock Tests', icon: FileText },
  { to: '/app/enter-exam', label: 'Enter Exam ID', icon: KeyRound },
  { to: '/app/results', label: 'Results', icon: Trophy },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/profile', label: 'Profile', icon: User },
];

export function StudentLayout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api
      .get('/student/notifications')
      .then(({ data }) => setUnread(data.unread))
      .catch(() => {});
  }, [loc.pathname]);

  const SidebarInner = (
    <div className="flex flex-col h-full">
      <Link
        to="/"
        className="flex items-center gap-2 px-5 h-16 border-b border-slate-800"
      >
        <GraduationCap className="h-6 w-6 text-[#D97706]" />
        <span className="font-display font-extrabold text-white text-lg">
          BePro
        </span>
      </Link>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => {
          const active = item.end
            ? loc.pathname === item.to
            : loc.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notifications' && unread > 0 && (
                <span className="text-xs bg-[#D97706] text-white rounded-full px-1.5">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-semibold text-white truncate">
            {user?.name}
          </p>
          <p className="text-xs text-slate-400 truncate">{user?.student_id}</p>
        </div>
        <button
          onClick={() => {
            logout();
            nav('/');
          }}
          data-testid="logout-btn"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 w-full"
        >
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-slate-900">
        {SidebarInner}
      </aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-900">{SidebarInner}</div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="lg:pl-64">
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b h-14 flex items-center px-4 gap-3">
          <button
            onClick={() => setOpen(true)}
            data-testid="mobile-sidebar-toggle"
          >
            <Menu />
          </button>
          <span className="font-display font-bold">BePro</span>
        </div>
        <main className="p-5 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
