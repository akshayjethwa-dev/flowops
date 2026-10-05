// src/components/ScanTriggerButton.tsx
import React, { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { useScanToIdentify, ResolvedEntity } from '../hooks/useScanToIdentify';
import { useAuth } from '../context/AuthContext';
import { ScanResult } from '../services/scannerService';

interface Props {
  onEntityResolved: (entity: ResolvedEntity) => void;
  hint?: string;
  label?: string;
  className?: string;
  /** If true, keeps the scanner open after a successful scan (multi-scan). */
  multiScan?: boolean;
}

export const ScanTriggerButton: React.FC<Props> = ({
  onEntityResolved,
  hint = 'Scan material, work order, or machine code',
  label = 'Scan',
  className,
  multiScan = false,
}) => {
  // ── FIX: derive tenantId from profile, not from context root ──
  const { profile, activePlantId } = useAuth();
  const tenantId = profile?.tenantId ?? null;

  const [open, setOpen] = useState(false);

  const { resolve } = useScanToIdentify(tenantId, {
    plantId: activePlantId === 'all' ? undefined : activePlantId ?? undefined,
  });

  const handleScan = async (result: ScanResult) => {
    const entity = await resolve(result);
    if (entity) {
      onEntityResolved(entity);
      if (!multiScan) setOpen(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors'
        }
      >
        <ScanLine size={16} className="text-indigo-400" />
        {label}
      </button>

      <BarcodeScanner
        isOpen={open}
        onClose={() => setOpen(false)}
        onScan={handleScan}
        hint={hint}
      />
    </>
  );
};