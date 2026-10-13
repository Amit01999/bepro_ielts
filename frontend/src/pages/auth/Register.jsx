import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, apiError } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GraduationCap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    target_ielts_type: 'academic',
    target_band: 7.0,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, target_band: Number(form.target_band) });
      toast.success('Account created — welcome to BePro!');
      nav('/app');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen grid lg:grid-cols-2"
      data-testid="register-page"
    >
      <div className="flex items-center justify-center p-6 order-2 lg:order-1">
        <form
          onSubmit={submit}
          className="w-full max-w-sm"
          data-testid="register-form"
        >
          <Link to="/" className="flex items-center gap-2 mb-8">
            <GraduationCap className="h-6 w-6 text-[#D97706]" />
            <span className="font-display font-extrabold text-xl">BePro</span>
          </Link>
          <h1 className="text-2xl font-bold font-display">
            Create your free account
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Take a free mock test in minutes. No card required.
          </p>
          {error && (
            <div
              className="mt-4 text-sm bg-red-50 text-red-700 rounded-md px-3 py-2"
              data-testid="register-error"
            >
              {error}
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
                className="mt-1.5"
                data-testid="register-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
                className="mt-1.5"
                data-testid="register-email"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                required
                minLength={6}
                className="mt-1.5"
                data-testid="register-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target type</Label>
                <Select
                  value={form.target_ielts_type}
                  onValueChange={v => set('target_ielts_type', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="register-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="general">General Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target band</Label>
                <Select
                  value={String(form.target_band)}
                  onValueChange={v => set('target_band', v)}
                >
                  <SelectTrigger className="mt-1.5" data-testid="register-band">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => (
                      <SelectItem key={b} value={String(b)}>
                        {b.toFixed(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-[#D97706] hover:bg-[#b45309] text-white h-11"
            data-testid="register-submit"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{' '}
            Create account
          </Button>
          <p className="text-sm text-center mt-6 text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#2563EB] font-semibold hover:underline"
              data-testid="to-login"
            >
              Log in
            </Link>
          </p>
        </form>
      </div>
      <div
        className="hidden lg:flex bg-slate-900 text-white flex-col justify-center p-12 order-1 lg:order-2 relative bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(15,23,42,0.6), rgba(15,23,42,0.88)), url(https://images.pexels.com/photos/3807755/pexels-photo-3807755.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=1000&w=800)",
          backgroundPosition: "center 25%",
        }}
      >
        <h2 className="text-3xl font-bold font-display">
          Start your IELTS journey today.
        </h2>
        <ul className="mt-8 space-y-4 text-slate-200">
          {[
            '1 free full mock test',
            '10 free practice sets',
            '3 free AI evaluations',
            'Detailed band analytics',
          ].map(t => (
            <li key={t} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#D97706]" /> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
