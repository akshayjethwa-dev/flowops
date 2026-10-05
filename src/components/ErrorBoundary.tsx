// src/components/ErrorBoundary.tsx

import * as React from 'react';
import { ShieldAlert, RefreshCcw, LayoutDashboard, Copy, Check } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught a rendering crash in enterprise workspace:', error, errorInfo);
    this.setState({
      errorInfo
    });
  }

  private handleReset = () => {
    window.location.href = '/dashboard';
  };

  private handleCopyDiagnostic = () => {
    const diagnosticPayload = JSON.stringify({
      error: this.state.error?.message || 'Unknown Error',
      stack: this.state.error?.stack || 'No Stack Available',
      componentStack: this.state.errorInfo?.componentStack || 'No Component Stack'
    }, null, 2);

    navigator.clipboard.writeText(diagnosticPayload)
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch((err) => console.error('Failed to copy diagnostics payload:', err));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="crash-recovery-view" className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-2xl w-full bg-white border border-slate-205 rounded-2xl p-7 shadow-xs text-left space-y-6">
            
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center text-rose-600 font-bold shrink-0">
                <ShieldAlert className="h-5.5 w-5.5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-rose-700 uppercase tracking-widest leading-none">
                  Crash Shield Recovery
                </h2>
                <h1 className="text-lg font-bold text-slate-900 mt-1">
                  The application ran into an unexpected visual render boundary mismatch.
                </h1>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide block">
                Error Signature Spec
              </span>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 font-mono text-[11px] text-rose-400 select-text overflow-x-auto whitespace-pre-wrap max-h-56">
                <strong>{this.state.error?.name || 'Error'}:</strong> {this.state.error?.message || 'No details provided'}
                {this.state.errorInfo && (
                  <div className="text-slate-450 mt-3 border-t border-slate-900 pt-3 opacity-90 leading-relaxed text-[10px]">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This usually happens when custom data states contain contradictory fields or have properties that are incomplete. Your workspace data on Firestore is untouched.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={this.handleCopyDiagnostic}
                className="w-full sm:w-auto font-mono text-[10px] uppercase font-bold tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-205 border border-slate-200 px-4 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                {this.state.copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-700">Payload Diagnostic Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-slate-450 shrink-0" />
                    <span>Copy JSON Diagnostics Payload</span>
                  </>
                )}
              </button>

              <div className="flex w-full sm:w-auto space-x-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto font-mono text-[10px] uppercase font-bold tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-slate-205 px-4 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <RefreshCcw className="h-3.5 w-3.5 text-slate-450 shrink-0" />
                  <span>Hard Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReset}
                  className="w-full sm:w-auto font-mono text-[10px] uppercase font-bold tracking-wider text-white bg-slate-900 hover:bg-slate-800 px-4 py-2.5 rounded-lg flex items-center justify-center space-x-1.5 transition shadow-2xs cursor-pointer"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Enter Dashboard</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
