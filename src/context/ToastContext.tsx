// src/context/ToastContext.tsx

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  description?: string;
  duration?: number;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (type: 'success' | 'error' | 'info', message: string, description?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  // Shortcut helper functions for simpler, cleaner call sites
  toastSuccess: (message: string, description?: string, duration?: number) => void;
  toastError: (message: string, description?: string, duration?: number) => void;
  toastInfo: (message: string, description?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string, description?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = { id, type, message, description, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastSuccess = useCallback(
    (message: string, description?: string, duration?: number) => {
      addToast('success', message, description, duration);
    },
    [addToast]
  );

  const toastError = useCallback(
    (message: string, description?: string, duration?: number) => {
      addToast('error', message, description, duration);
    },
    [addToast]
  );

  const toastInfo = useCallback(
    (message: string, description?: string, duration?: number) => {
      addToast('info', message, description, duration);
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toastSuccess, toastError, toastInfo }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// UI Component for rendering Toasts
interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div 
      id="toast-notifications-root"
      className="fixed top-4 right-4 z-50 flex flex-col space-y-3.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const typeConfig = {
            success: {
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />,
              borderClass: 'border-emerald-200 bg-emerald-50 text-emerald-950',
              accentLight: 'bg-emerald-100/50',
            },
            error: {
              icon: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />,
              borderClass: 'border-rose-250 bg-rose-50 text-rose-950',
              accentLight: 'bg-rose-100/50',
            },
            info: {
              icon: <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />,
              borderClass: 'border-indigo-200 bg-indigo-50 text-indigo-950',
              accentLight: 'bg-indigo-100/50',
            }
          }[toast.type];

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.15 } }}
              className={`p-3.5 rounded-xl border shadow-md pointer-events-auto flex items-start space-x-3 transition-colors ${typeConfig.borderClass}`}
            >
              {typeConfig.icon}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold font-sans tracking-tight leading-4">
                  {toast.message}
                </h4>
                {toast.description && (
                  <p className="text-[11px] font-sans mt-1 leading-4 text-slate-500 opacity-90 whitespace-pre-line">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="text-slate-400 hover:text-slate-800 p-0.5 rounded-lg hover:bg-black/5 shrink-0 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
