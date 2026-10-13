import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { apiError } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      data-testid="forgot-page"
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <GraduationCap className="h-6 w-6 text-[#D97706]" />
          <span className="font-display font-extrabold text-xl">BePro</span>
        </Link>
        {done ? (
          <div data-testid="forgot-done">
            <h1 className="text-2xl font-bold font-display">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              If an account exists for {email}, a reset link has been sent. (In
              this demo the token is printed to the backend logs.)
            </p>
            <Link to="/login">
              <Button variant="outline" className="mt-6 w-full">
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} data-testid="forgot-form">
            <h1 className="text-2xl font-bold font-display">Forgot password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email and we'll send a reset link.
            </p>
            {error && (
              <div className="mt-4 text-sm bg-red-50 text-red-700 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div className="mt-6">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="mt-1.5"
                data-testid="forgot-email"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-5 bg-slate-900 text-white h-11"
              data-testid="forgot-submit"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Send
              reset link
            </Button>
            <p className="text-sm text-center mt-6">
              <Link to="/login" className="text-[#2563EB] hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
