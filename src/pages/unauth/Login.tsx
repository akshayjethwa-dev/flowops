import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { TextField } from '../../components/ui/TextField';
import { Factory, Shield, Hammer, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signInWithGoogle, initializeSandbox } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Error and local validation states
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [sandboxCompanyName, setSandboxCompanyName] = useState('Bharat Gears & Castings Ltd.');
  const [isDemoConfiguring, setIsDemoConfiguring] = useState(false);

  // Quick email format pattern check
  const validateEmailFormat = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!validateEmailFormat(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    // Clear sandbox keys first to ensure clean session
    localStorage.removeItem('flowops_sandbox_profile');
    localStorage.removeItem('flowops_sandbox_tenant');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth observer in AuthContext will automatically update and set state
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Firebase sign-in error:', err);
      let friendlyMessage = 'An unexpected error occurred during sign-in. Please try again.';
      
      const errCode = err?.code || '';
      if (errCode === 'auth/invalid-credential' || errCode === 'auth/wrong-password' || errCode === 'auth/user-not-found') {
        friendlyMessage = 'Invalid email or password. Please verify your credentials and try again.';
      } else if (errCode === 'auth/invalid-email') {
        friendlyMessage = 'The email address format is invalid.';
      } else if (errCode === 'auth/network-request-failed') {
        friendlyMessage = 'Network connection failed. Please check your internet connectivity.';
      } else if (errCode === 'auth/user-disabled') {
        friendlyMessage = 'Your operator profile has been disabled by the administrator.';
      } else if (errCode === 'auth/too-many-requests') {
        friendlyMessage = 'Too many failed sign-in attempts. Your access has been temporarily blocked. Please retry later.';
      }

      setFormErrors({ general: friendlyMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    initializeSandbox(sandboxCompanyName);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-sky-500 selection:text-white font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xs p-8 relative overflow-hidden">
        {/* Decorative subtle background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        <div className="relative z-10">
          {/* Logo Heading */}
          <div className="flex items-center space-x-2.5 mb-6 justify-center">
            <div className="bg-sky-600 p-2 rounded shadow-xs shrink-0">
              <Factory className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-sky-600 uppercase leading-none block">SME Flow Engine</span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Ashrey FlowOps</h1>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-sm font-semibold text-slate-800">Sign in to manage your factory operations</h2>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Track manufacturing pipelines, log customer RFQs, and coordinate plant dispatches in one secure environment.
            </p>
          </div>

          {formErrors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-md font-medium">
              {formErrors.general}
            </div>
          )}

          {/* Standard Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              id="login-email"
              label="Operator Email"
              type="email"
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={formErrors.email}
              required
              disabled={loading}
              autoComplete="email"
            />

            <div className="space-y-1">
              <TextField
                id="login-password"
                label="Security Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={formErrors.password}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-sky-600 hover:text-sky-500 cursor-pointer focus:underline focus:outline-hidden"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-bold rounded flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider relative"
            >
              {loading ? (
                <span className="flex items-center space-x-1.5">
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Signing In...</span>
                </span>
              ) : (
                <span>Sign In Securely</span>
              )}
            </button>
          </form>

          {/* Alternative Auth / Sandbox and Google logins */}
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-slate-100" />
            <span className="flex-shrink mx-3 text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase">Demo & Review Tools</span>
            <div className="flex-grow border-t border-slate-100" />
          </div>

          <div className="space-y-3">
            {/* Google Authentication */}
            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                  navigate('/dashboard');
                } catch (e) {
                  console.error(e);
                }
              }}
              className="w-full h-10 bg-white hover:bg-slate-50 text-slate-850 border border-slate-250 font-bold py-2 px-3 rounded flex items-center justify-center space-x-2.5 shadow-2xs transition-colors cursor-pointer text-xs uppercase tracking-wide"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.71v3.08h3.95c2.31-2.13 3.63-5.26 3.63-8.64z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.95-3.08c-1.1.74-2.51 1.18-4.01 1.18-3.08 0-5.7-2.08-6.63-4.88H1.36v3.18A11.97 11.97 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.37 14.31A7.16 7.16 0 0 1 5 12c0-.81.14-1.61.37-2.31V6.51H1.36A11.94 11.94 0 0 0 0 12c0 2.05.52 4.01 1.36 5.49l4.01-3.18z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.33 2.68 1.36 6.51l4.01 3.18c.93-2.8 3.55-4.88 6.63-4.88z"
                />
              </svg>
              <span>Login with Google</span>
            </button>

            {/* Sandbox launcher */}
            {!isDemoConfiguring ? (
              <button
                type="button"
                onClick={() => setIsDemoConfiguring(true)}
                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer text-xs uppercase tracking-wide"
                id="sandbox-launch-btn"
              >
                <Hammer className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span>Launch Demo Sandbox</span>
              </button>
            ) : (
              <form onSubmit={handleSandboxLaunch} className="space-y-3 bg-slate-50 p-4 border border-slate-200 rounded">
                <TextField
                  id="demo-company-name"
                  label="Sandbox Enterprise Name"
                  value={sandboxCompanyName}
                  onChange={(e) => setSandboxCompanyName(e.target.value)}
                  required
                />
                <div className="flex space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDemoConfiguring(false)}
                    className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs py-2 rounded font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded flex items-center justify-center space-x-1 cursor-pointer text-xs uppercase tracking-wide"
                  >
                    <span>Launch</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Safety info footnote standard check */}
      <div className="mt-8 flex items-center space-x-1.5 text-slate-400 text-[10px] max-w-sm text-center font-mono">
        <Shield className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <p>Enterprise sub-tenant boundaries are secured under multi-tenant access control schemas.</p>
      </div>
    </div>
  );
};
