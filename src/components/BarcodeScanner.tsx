// src/components/BarcodeScanner.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraScanner, createHardwareScannerListener, parseScan, ScanResult } from '../services/scannerService';
import { X, Camera, Keyboard, ScanLine } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
  hint?: string;
}

export const BarcodeScanner: React.FC<Props> = ({ isOpen, onClose, onScan, hint }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<CameraScanner | null>(null);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);

  const handleResult = useCallback((result: ScanResult) => {
    const parsed = parseScan(result.raw);
    setLastScan(parsed);
    onScan(parsed);
    // Brief haptic-like feedback
    if (navigator.vibrate) navigator.vibrate(80);
  }, [onScan]);

  // Camera mode lifecycle
  useEffect(() => {
    if (!isOpen || mode !== 'camera' || !videoRef.current) return;

    const scanner = new CameraScanner();
    scannerRef.current = scanner;

    scanner.start(videoRef.current, handleResult).catch(err => {
      setError('Camera access denied. Use manual entry.');
      setMode('manual');
    });

    return () => scanner.stop();
  }, [isOpen, mode, handleResult]);

  // Hardware scanner listener (always active when open)
  useEffect(() => {
    if (!isOpen) return;
    const cleanup = createHardwareScannerListener(handleResult);
    return cleanup;
  }, [isOpen, handleResult]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ScanLine size={18} className="text-indigo-400" />
            <h3 className="font-semibold text-slate-200">Scan Barcode / QR</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => { setMode('camera'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mode === 'camera' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'
            }`}
          >
            <Camera size={16} /> Camera
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              mode === 'manual' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-500'
            }`}
          >
            <Keyboard size={16} /> Manual
          </button>
        </div>

        {/* Camera mode */}
        {mode === 'camera' && (
          <div className="relative aspect-square bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            {/* Scan reticle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 border-2 border-indigo-400/70 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                <div className="absolute left-0 right-0 h-0.5 bg-indigo-400/80 animate-pulse top-1/2" />
              </div>
            </div>
            {hint && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="px-3 py-1.5 bg-black/70 rounded-full text-xs text-slate-300">{hint}</span>
              </div>
            )}
          </div>
        )}

        {/* Manual mode */}
        {mode === 'manual' && (
          <div className="p-4 space-y-3">
            <p className="text-xs text-slate-500">
              Type or paste the barcode value. Hardware scanners work here too.
            </p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualInput.trim()) {
                    handleResult({ raw: manualInput.trim(), format: 'manual', timestamp: Date.now() });
                    setManualInput('');
                  }
                }}
                placeholder="e.g., MAT-00123, WO-00456"
                className="flex-1 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  if (manualInput.trim()) {
                    handleResult({ raw: manualInput.trim(), format: 'manual', timestamp: Date.now() });
                    setManualInput('');
                  }
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white"
              >
                Submit
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Last scan feedback */}
        {lastScan && (
          <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-300 truncate">{lastScan.raw}</p>
              {lastScan.target && (
                <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">
                  {lastScan.target} · {lastScan.entityId}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};