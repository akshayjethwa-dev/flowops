// src/components/AuthScreen.tsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Hammer, Factory, ArrowRight } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, initializeSandbox } = useAuth();
  const [sandboxCompanyName, setSandboxCompanyName] = useState('Bharat Gears & Castings Ltd.');
  const [isDemoConfiguring, setIsDemoConfiguring] = useState(false);

  const handleSandboxLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    initializeSandbox(sandboxCompanyName);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 selection:bg-sky-500 selection:text-white font-sans">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-7 relative overflow-hidden">
        {/* Decorative Grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:16px_16px]" />
        
        <div className="relative z-10">
          {/* Logo Heading */}
          <div className="flex items-center space-x-2.5 mb-6">
            <div className="bg-sky-600 p-2 rounded shadow-sm">
              <Factory className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold tracking-widest text-sky-600 uppercase">SME Flow Engine</span>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 font-display">Ashrey FlowOps</h1>
            </div>
          </div>

          <p className="text-slate-500 text-xs leading-relaxed mb-6">
            Cloud-scale shopfloor workflow managers: RFQs, Costing Sheets, CNC/foundry line stations, and automated status alerts.
          </p>

          {/* Authentic Google Enterprise Login */}
          <button
            onClick={signInWithGoogle}
            className="w-full h-10 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold py-2 px-3 rounded flex items-center justify-center space-x-2.5 shadow-xs transition-transform duration-100 cursor-pointer text-xs uppercase tracking-wider"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
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
            <span>Google Account login</span>
          </button>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-100" />
            <span className="flex-shrink mx-3 text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase">OR</span>
            <div className="flex-grow border-t border-slate-100" />
          </div>

          {/* Interactive Sandbox Launch */}
          {!isDemoConfiguring ? (
            <button
              onClick={() => setIsDemoConfiguring(true)}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded flex items-center justify-center space-x-1.5 transition-colors cursor-pointer text-xs uppercase tracking-wider"
              id="sandbox-launch-btn"
            >
              <Hammer className="h-3.5 w-3.5 text-sky-400" />
              <span>Launch Demo Sandbox</span>
            </button>
          ) : (
            <form onSubmit={handleSandboxLaunch} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Enter Factory / Company Name
                </label>
                <input
                  type="text"
                  required
                  value={sandboxCompanyName}
                  onChange={(e) => setSandboxCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-805 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="e.g. Bharat Gears & Castings Ltd."
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsDemoConfiguring(false)}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs py-2 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded flex items-center justify-center space-x-1 cursor-pointer text-xs uppercase tracking-wide"
                >
                  <span>Build Demo Unit</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1 text-white" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Trust Signpost / Footnotes */}
      <div className="mt-8 flex items-center space-x-1.5 text-slate-400 text-[10px] max-w-xs text-center font-mono">
        <Shield className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
        <p>Enterprise database rules are enforced. Sub-tenant separation is checked on every query.</p>
      </div>
    </div>
  );
};
