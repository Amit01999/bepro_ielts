import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, apiError } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success('Welcome back!');
      nav(u.role === 'student' ? '/app' : '/admin');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2" data-testid="login-page">
      <div
        className="hidden lg:flex bg-slate-900 text-white flex-col justify-between p-12 relative bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(15,23,42,0.55), rgba(15,23,42,0.88)), url(https://images.pexels.com/photos/6549587/pexels-photo-6549587.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1000&w=800)",
        }}
      >
        <Link to="/" className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-[#D97706]" />
          <span className="font-display font-extrabold text-xl">BePro</span>
        </Link>
        <div>
          <h2 className="text-3xl font-bold font-display">
            Continue your journey to your target band.
          </h2>
          <p className="mt-4 text-slate-300">
            Realistic mocks, skill practice and AI feedback — all in one place.
          </p>
        </div>
        <p className="text-xs text-slate-500">© 2026 BePro IELTS</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-sm"
          data-testid="login-form"
        >
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <GraduationCap className="h-6 w-6 text-[#D97706]" />
            <span className="font-display font-extrabold text-xl">BePro</span>
          </Link>
          <h1 className="text-2xl font-bold font-display">Log in</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your credentials to access your dashboard.
          </p>
          {error && (
            <div
              className="mt-4 text-sm bg-red-50 text-red-700 rounded-md px-3 py-2"
              data-testid="login-error"
            >
              {error}
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="mt-1.5"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="mt-1.5"
                data-testid="login-password"
              />
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Link
              to="/forgot-password"
              className="text-sm text-[#2563EB] hover:underline"
              data-testid="forgot-link"
            >
              Forgot password?
            </Link>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white h-11"
            data-testid="login-submit"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Log
            in
          </Button>
          <p className="text-sm text-center mt-6 text-muted-foreground">
            No account?{' '}
            <Link
              to="/register"
              className="text-[#2563EB] font-semibold hover:underline"
              data-testid="to-register"
            >
              Start free
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
