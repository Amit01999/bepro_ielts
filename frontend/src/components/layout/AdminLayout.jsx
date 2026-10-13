import { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, GraduationCap, Package, FileText, BookOpen, Database,
  Settings, Shield, ScrollText, LogOut, Menu, ClipboardCheck, UserCog,
} from "lucide-react";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true, perm: null },
  { to: "/admin/students", label: "Students", icon: Users, perm: "students.view" },
  { to: "/admin/batches", label: "Batches", icon: GraduationCap, perm: null },
  { to: "/admin/staff", label: "Staff & Roles", icon: UserCog, perm: null },
  { to: "/admin/packages", label: "Packages", icon: Package, perm: "packages.manage" },
  { to: "/admin/exams", label: "Exams", icon: FileText, perm: "exams.create" },
  { to: "/admin/questions", label: "Question Bank", icon: Database, perm: "questions.manage" },
  { to: "/admin/practice", label: "Practice", icon: BookOpen, perm: "practice.manage" },
  { to: "/admin/reviews", label: "Reviews", icon: ClipboardCheck, perm: null },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText, perm: "settings.manage" },
  { to: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
];

export function AdminLayout() {
  const { user, logout, hasPermission } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => !i.perm || hasPermission(i.perm) || user?.role === "super_admin");

  const SidebarInner = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <Shield className="h-6 w-6 text-[#D97706]" />
        <div>
          <span className="font-display font-extrabold text-white text-base block leading-none">BePro</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Admin Console</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {items.map((item) => {
          const active = item.end ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
              data-testid={`admin-sidebar-${item.label.toLowerCase().replace(/ &/g, "").replace(/ /g, "-")}`}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active ? "bg-[#2563EB] text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white")}>
              <Icon className="h-[18px] w-[18px]" /> {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role?.replace("_", " ")}</p>
        </div>
        <button onClick={() => { logout(); nav("/"); }} data-testid="admin-logout-btn" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 w-full">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-slate-900">{SidebarInner}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-slate-900">{SidebarInner}</div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
      <div className="lg:pl-64">
        <div className="lg:hidden sticky top-0 z-40 bg-white border-b h-14 flex items-center px-4 gap-3">
          <button onClick={() => setOpen(true)} data-testid="admin-mobile-toggle"><Menu /></button>
          <span className="font-display font-bold">Admin Console</span>
        </div>
        <main className="p-5 md:p-8 max-w-[1400px] mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
