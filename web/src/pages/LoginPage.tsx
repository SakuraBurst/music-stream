import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AuthApiError } from '../api/auth.ts';
import { useAuthStore } from '../store/authStore.ts';
import Starfield from '../components/Cosmic/Starfield.tsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof AuthApiError) setError(err.message);
      else setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen cosmic-bg">
      <Starfield />
      <div className="relative z-[2] w-full max-w-sm px-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-12 h-12 mb-4 grid place-items-center">
            <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full overflow-visible">
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--line2)" strokeWidth="1" strokeDasharray="1 3" />
              <circle cx="24" cy="24" r="14" fill="var(--sun)" opacity="0.18" />
              <circle cx="24" cy="24" r="8"  fill="var(--sun)" className="sun-pulse" />
              <circle cx="44" cy="10" r="1.5" fill="var(--rose)" />
            </svg>
          </div>
          <h1 className="font-serif text-[28px] text-[var(--ink)]">Welcome back</h1>
          <p className="font-mono-jb text-[10px] tracking-[3px] text-[var(--mute)] uppercase mt-2">
            ◉ SONUS · OBSERVATORY
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border border-[var(--rose)] px-3 py-2 text-[12px] text-[var(--rose)] font-mono-jb">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username"
                   className="block font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--line2)] text-[var(--ink)] placeholder-[var(--mute)]
                         focus:outline-none focus:border-[var(--sun)] transition-colors"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label htmlFor="password"
                   className="block font-mono-jb text-[9px] tracking-[2px] text-[var(--mute)] uppercase mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--line2)] text-[var(--ink)] placeholder-[var(--mute)]
                         focus:outline-none focus:border-[var(--sun)] transition-colors"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-mono-jb text-[10px] tracking-[3px] uppercase px-3 py-3
                       border border-[var(--sun)] text-[var(--sun)]
                       hover:bg-[rgba(217,178,90,0.08)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : '◉ Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono-jb text-[10px] tracking-[2px] text-[var(--mute)] uppercase">
          Don't have an account?{' '}
          <Link to="/register" className="text-[var(--sun)] hover:text-[var(--ink)] transition-colors">
            Create one →
          </Link>
        </p>
      </div>
    </div>
  );
}
