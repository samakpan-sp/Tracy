import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { GoogleIcon, EyeIcon, EyeOffIcon, ArrowRightIcon } from './icons';

function AuthForm({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
  };

  const handleForgotPassword = async () => {
    setError(null);
    setResetSent(false);
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?"');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setResetSent(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === 'signup' && !data.session) {
      setError('Signup successful — check your email to confirm, then log in.');
      return;
    }
    onAuthSuccess(data.session);
  };

  const inputClass =
    'w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-trust transition';

  return (
    <div>
      <div className="flex bg-bg rounded-lg p-1 mb-6">
        {['login', 'signup'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition
              ${mode === m ? 'bg-surface2 text-gray-100' : 'text-gray-500'}`}
          >
            {m === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      <h2 className="font-display text-xl font-semibold mb-1">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {mode === 'login' ? 'Sign in to access your investigation workspace' : 'Start investigating with TRACY in a few seconds'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email address</label>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <label className="text-sm font-medium">Password</label>
            {mode === 'login' && (
              <button type="button" onClick={handleForgotPassword} className="text-xs text-trust hover:underline">
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <input
              className={inputClass + ' pr-10'}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {mode === 'login' && (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" defaultChecked className="accent-trust" />
            Keep me signed in for 30 days
          </label>
        )}

        {resetSent && <p className="text-sm text-trust">Password reset email sent — check your inbox.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-trust text-[#06231F] font-medium
                     py-3 rounded-lg hover:brightness-110 transition disabled:opacity-60"
        >
          {loading ? (
            'Please wait...'
          ) : (
            <>
              <ArrowRightIcon />
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5 text-xs text-gray-500">
        <div className="flex-1 h-px bg-border" /> or <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-2.5 bg-surface2 border border-border
                   text-gray-100 text-sm font-medium py-2.5 rounded-lg hover:bg-border/60 transition"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </div>
  );
}

export default AuthForm;