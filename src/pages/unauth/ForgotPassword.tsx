import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase';
import { TextField } from '../../components/ui/TextField';
import { Factory, Shield, ArrowLeft } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset link failed:', err);
      const errCode = err?.code || '';
      
      if (errCode === 'auth/invalid-email') {
        setError('Please enter a valid email address format.');
      } else if (errCode === 'auth/network-request-failed') {
        setError('Connection failed. Please check your network and try again.');
      } else {
        // Safe security behavior: always output a success screen or standard feedback if requested
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-sky-500 selection:text-white font-sans">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-xs p-8 relative overflow-hidden">
        {/* Decorative background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        <div className="relative z-10">
          {/* Header Title */}
          <div className="flex items-center space-x-2.5 mb-6 justify-center">
            <div className="bg-sky-600 p-2 rounded shadow-xs shrink-0">
              <Factory className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-sky-600 uppercase leading-none block">Operator Keys</span>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-none block">Credential Recovery</h1>
            </div>
          </div>

          <p className="text-slate-505 text-xs text-center leading-relaxed mb-6">
            Enter your operating profile email address to receive a secure credentials reset path link.
          </p>

          {success ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-md text-emerald-800 text-xs leading-relaxed">
                <p className="font-bold mb-1">✓ Link Sent Code</p>
                If this email exists in our system, a secure key reset link has been dispatched to it. Please check your inbox and spam folders.
              </div>
              <Link
                to="/login"
                className="w-full h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider space-x-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Login</span>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <TextField
                id="reset-email"
                label="Registered Operator Email"
                type="email"
                placeholder="operator@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error || undefined}
                required
                disabled={loading}
                autoComplete="email"
                helperText="We will send a reset password link to this email address."
              />

              <div className="space-y-2.5 flex flex-col pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-bold rounded flex items-center justify-center transition-colors cursor-pointer text-xs uppercase tracking-wider relative"
                >
                  {loading ? (
                    <span className="flex items-center space-x-1.5">
                      <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Sending reset...</span>
                    </span>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>

                <Link
                  to="/login"
                  className="w-full h-10 bg-transparent text-slate-500 hover:text-slate-705 border border-slate-200 hover:border-slate-300 font-bold rounded flex items-center justify-center transition-all cursor-pointer text-xs uppercase tracking-wider space-x-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                  <span>Back to Login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Trust Signpost / Footnotes */}
      <div className="mt-8 flex items-center space-x-1.5 text-slate-400 text-[10px] max-w-xs text-center font-mono">
        <Shield className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <p>Enterprise database rules are enforced. Sub-tenant separation check active.</p>
      </div>
    </div>
  );
};
