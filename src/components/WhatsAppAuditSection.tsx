// src/components/WhatsAppAuditSection.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { WhatsAppLog } from '../types';
import { MessageSquare, RefreshCw, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const WhatsAppAuditSection: React.FC = () => {
  const { profile, tenant, isSandboxMode } = useAuth();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || !tenant) return;

    if (isSandboxMode) {
      // Pull and sort sandboxed logs
      const cached = localStorage.getItem(`whatsappLogs_${tenant.id}`) || '[]';
      const parsed = JSON.parse(cached) as WhatsAppLog[];
      setLogs(parsed.sort((a,b) => b.sentAt.localeCompare(a.sentAt)));
      setLoading(false);
    } else {
      const path = 'whatsappLogs';
      // Secure Tenant query bounding
      const q = query(
        collection(db, path),
        where('tenantId', '==', tenant.id),
        orderBy('sentAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: WhatsAppLog[] = [];
        snapshot.forEach(docSnap => {
          list.push({ ...docSnap.data() } as WhatsAppLog);
        });
        setLogs(list);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    }
  }, [profile, tenant, isSandboxMode]);

  const handleFetchUpdates = () => {
    if (!tenant) return;
    setLoading(true);
    if (isSandboxMode) {
      const cached = localStorage.getItem(`whatsappLogs_${tenant.id}`) || '[]';
      setLogs(JSON.parse(cached));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION HEADER ACTIONS */}
      <div className="flex justify-between items-center bg-slate-950 text-slate-100 p-4 rounded-lg border border-slate-900 shadow-sm">
        <div className="flex items-center space-x-2.5 text-xs leading-relaxed text-slate-300">
          <MessageSquare className="h-4.5 w-4.5 text-sky-450 shrink-0" />
          <p className="font-sans">This panel displays outgoing notification campaigns triggered via AiSensy BSP. In production, templates receive dynamic blue delivery tick hooks.</p>
        </div>
        <button
          onClick={handleFetchUpdates}
          className="border border-slate-800 bg-slate-900 text-slate-300 font-mono text-xs px-3 py-1.5 rounded hover:bg-slate-800 hover:text-white flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>Refresh</span>
        </button>
      </div>

      {/* WHATSAPP OUTBOX FEED */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : logs.length > 0 ? (
        <div className="space-y-3.5 animate-pulse-slow">
          {logs.map(log => (
            <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row justify-between sm:items-start gap-2.5">
              <div className="space-y-2 sm:max-w-xl">
                
                {/* Heading line */}
                <div className="flex items-center flex-wrap gap-2 text-[10px] font-mono">
                  <span className="font-bold text-slate-650 bg-slate-100 px-2.0 py-0.5 rounded uppercase">
                    Template: {log.type || 'Custom'}
                  </span>
                  <span className="text-slate-400">
                    {new Date(log.sentAt?.seconds ? log.sentAt.seconds * 1000 : log.sentAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 border border-slate-100 rounded px-3 py-2 italic font-mono">
                  "{log.message}"
                </p>

                <div className="text-xs text-slate-500 font-medium">
                  Sent to: <span className="font-bold text-slate-805">{log.recipientName}</span> <span className="font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold">+{log.recipientPhone}</span>
                </div>

              </div>

              {/* Status side */}
              <div className="flex items-center gap-1.5 self-end sm:self-center bg-slate-50 border border-slate-200 rounded px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-[9px] uppercase font-mono tracking-wider font-bold text-slate-650">
                  {log.status}
                </span>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-lg">
          <p className="text-slate-400 text-xs">No notifications logged. Trigger quotes or advances on orders to generate WhatsApp templates.</p>
        </div>
      )}

    </div>
  );
};
