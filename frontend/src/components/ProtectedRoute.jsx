import { useAuth } from "@/lib/auth";
import { Navigate, useLocation } from "react-router-dom";
import { Loading } from "@/components/shared/States";

export function ProtectedRoute({ children, staffOnly, studentOnly }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="min-h-screen flex items-center justify-center"><Loading /></div>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (staffOnly && user.role === "student") return <Navigate to="/app" replace />;
  if (studentOnly && user.role !== "student") return <Navigate to="/admin" replace />;
  return children;
}
