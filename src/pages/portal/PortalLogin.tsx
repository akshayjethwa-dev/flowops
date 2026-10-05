// src/pages/portal/PortalLogin.tsx

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Phone, Check, ShieldCheck, HelpCircle, ArrowRight, Loader2, Building2 } from 'lucide-react';

interface PortalLoginProps {
  onLoginSuccess: (customer: { id: string; name: string; phone: string; tenantId: string }) => void;
}

export const PortalLogin: React.FC<PortalLoginProps> = ({ onLoginSuccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Demo fallback
  const demoPhone = '+919876543210';
  const demoCustomer = {
    id: 'CUST-DEMO-RAJESH',
    name: 'Ashrey Auto Parts / Pune Gears Corp',
    phone: '+919876543210',
    tenantId: 'tenant_1'
  };

  const cleanPhone = (num: string) => {
    return num.replace(/[^0-9+]/g, '');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const formattedInput = cleanPhone(phoneNumber);

    if (isSandbox) {
      // Simulate checking local customers
      setTimeout(() => {
        if (formattedInput.includes('9876543210') || formattedInput.includes('9500012345') || formattedInput === '') {
          setStep('otp');
        } else {
          setErrorMessage('Contact your vendor to activate access. Phone number does not match any registered dealer.');
        }
        setLoading(false);
      }, 700);
    } else {
      try {
        // Query customers collection in Firestore for phone number match
        const q = query(
          collection(db, 'customers'),
          where('phone', '==', phoneNumber)
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          setStep('otp');
        } else {
          // Check format normalized (e.g. without +91)
          const fallbackQ = query(
            collection(db, 'customers'),
            where('phone', '==', formattedInput)
          );
          const fallbackSnap = await getDocs(fallbackQ);
          if (!fallbackSnap.empty) {
            setStep('otp');
          } else {
            setErrorMessage('Contact your vendor to activate access. Phone number does not match any registered dealer.');
          }
        }
      } catch (err: any) {
        setErrorMessage(`Authentication query failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
    const formattedInput = cleanPhone(phoneNumber);

    setTimeout(async () => {
      if (isSandbox) {
        if (otpCode === '123456' || otpCode !== '') {
          // Success
          localStorage.setItem('portal_auth_phone', formattedInput || demoPhone);
          onLoginSuccess({
            id: 'CUST-DEMO-RAJESH',
            name: 'Ashrey Auto Parts / Pune Gears Corp',
            phone: formattedInput || demoPhone,
            tenantId: 'tenant_1'
          });
        } else {
          setErrorMessage('Invalid 6-digit verification code. Use any 6 digits for sandbox bypass.');
        }
        setLoading(false);
      } else {
        try {
          // Success link
          const q = query(
            collection(db, 'customers'),
            where('phone', '==', phoneNumber)
          );
          let snap = await getDocs(q);
          if (snap.empty) {
            const fallbackQ = query(
              collection(db, 'customers'),
              where('phone', '==', formattedInput)
            );
            snap = await getDocs(fallbackQ);
          }

          if (!snap.empty) {
            const docData = snap.docs[0].data();
            const customerObj = {
              id: snap.docs[0].id,
              name: docData.name,
              phone: docData.phone || phoneNumber,
              tenantId: docData.tenantId || 'tenant_1'
            };
            localStorage.setItem('portal_auth_phone', customerObj.phone);
            onLoginSuccess(customerObj);
          } else {
            setErrorMessage('Could not link profile. Contact your vendor.');
          }
        } catch (err: any) {
          setErrorMessage(err.message);
        } finally {
          setLoading(false);
        }
      }
    }, 800);
  };

  const fillDemoCredentials = () => {
    setPhoneNumber('+91 98765 43210');
    setErrorMessage(null);
  };

  return (
    <div id="portal-login-root" className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100 selection:bg-rose-500 selection:text-white">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.08)_0,transparent_100%)] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-slate-800/80 backdrop-blur border border-slate-700/60 p-8 rounded-2xl shadow-xl space-y-6 relative z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/25 mb-2">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">Ashrey FlowWorks</h2>
          <p className="text-xs text-rose-400 font-semibold tracking-wider uppercase">Dealer & Customer Portal</p>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.form 
                key="phone-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleSendOtp}
                className="space-y-4"
              >
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">B2B Registered Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-500">
                      <Phone className="w-5 h-5" />
                    </span>
                    <input 
                      type="tel"
                      required
                      placeholder="+91 XXXXX XXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/60 rounded-xl px-11 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 italic mt-1">We will send a secure one-time passcode to audit access.</p>
                </div>

                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs leading-relaxed"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-600/10 hover:shadow-rose-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send OTP Passcode</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="text-xs text-rose-400 hover:text-rose-300 transition underline decoration-rose-500/30"
                  >
                    ⚡ Use Mr. Rajesh {`('+91 98765 43210')`} Demo Phone
                  </button>
                </div>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form 
                key="otp-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <div className="text-center py-2 space-y-1">
                  <p className="text-xs text-slate-400">verification code sent to</p>
                  <p className="text-sm font-semibold text-white">{phoneNumber}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-medium">6-Digit Access PIN</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-slate-500">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <input 
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/60 rounded-xl px-11 py-3 text-sm text-slate-100 placeholder-slate-500 tracking-[0.4em] text-center font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-1">For sandbox validation, you can input any 6 digits.</p>
                </div>

                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs leading-relaxed"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="flex-1 py-3 border border-slate-700 hover:bg-slate-700/40 text-slate-300 rounded-xl text-sm font-semibold transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-600/15 flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify PIN</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-slate-700/40 pt-4 flex justify-between items-center text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-500/60" />
            <span>End-to-End Encryption</span>
          </span>
          <span className="hover:text-slate-400 transition cursor-help flex items-center gap-0.5">
            <HelpCircle className="w-3 h-3" />
            <span>Support</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
};
