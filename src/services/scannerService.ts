// src/services/scannerService.ts
/**
 * Unified barcode scanning abstraction.
 * Supports:
 *  - Camera-based scanning (expo-camera / browser getUserMedia)
 *  - Hardware scanners (Zebra DataWedge, Honeywell Intent API)
 *  - Manual keyboard-wedge input
 */

export type ScanTarget = 'material' | 'workOrder' | 'machine' | 'location' | 'batch';

export interface ScanResult {
  raw: string;
  format: string;          // 'qr' | 'code128' | 'ean13' | etc.
  target?: ScanTarget;     // resolved entity type
  entityId?: string;       // resolved entity ID
  timestamp: number;
}

export type ScanHandler = (result: ScanResult) => void;

// ─── Camera Scanner ────────────────────────────────────────────

export class CameraScanner {
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private detector: any = null;
  private rafId: number | null = null;

  async start(videoElement: HTMLVideoElement, onScan: ScanHandler): Promise<void> {
    this.videoEl = videoElement;

    // Check for native BarcodeDetector API
    if ('BarcodeDetector' in window) {
      // @ts-ignore
      this.detector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'pdf417', 'data_matrix'],
      });
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    videoElement.srcObject = this.stream;
    await videoElement.play();

    const scanLoop = async () => {
      if (!this.videoEl || !this.detector) return;
      try {
        const barcodes = await this.detector.detect(this.videoEl);
        if (barcodes.length > 0) {
          const bc = barcodes[0];
          onScan({
            raw: bc.rawValue,
            format: bc.format,
            timestamp: Date.now(),
          });
        }
      } catch (e) {
        // Detection error — continue
      }
      this.rafId = requestAnimationFrame(scanLoop);
    };

    scanLoop();
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.videoEl = null;
  }
}

// ─── Entity Resolution ─────────────────────────────────────────

/**
 * Prefix conventions for QR codes:
 *   MAT-xxxx   → Raw Material
 *   WO-xxxx    → Work Order
 *   MC-xxxx    → Machine / Work Center
 *   LOC-xxxx   → Storage Location
 *   LOT-xxxx   → Batch / Lot
 */
export function parseScan(raw: string): ScanResult {
  const upper = raw.trim().toUpperCase();
  const result: ScanResult = { raw, format: 'unknown', timestamp: Date.now() };

  if (upper.startsWith('MAT-')) { result.target = 'material'; result.entityId = upper; }
  else if (upper.startsWith('WO-')) { result.target = 'workOrder'; result.entityId = upper; }
  else if (upper.startsWith('MC-')) { result.target = 'machine'; result.entityId = upper; }
  else if (upper.startsWith('LOC-')) { result.target = 'location'; result.entityId = upper; }
  else if (upper.startsWith('LOT-')) { result.target = 'batch'; result.entityId = upper; }

  return result;
}

// ─── Hardware Scanner Hook ─────────────────────────────────────

/**
 * Hook for Zebra / Honeywell hardware scanners (Android).
 * These devices broadcast scan results as keyboard events or intents.
 * For web/PWA, we listen to rapid keypress sequences ending with Enter.
 */
export function createHardwareScannerListener(onScan: ScanHandler): () => void {
  let buffer = '';
  let lastKeyTime = 0;

  const handler = (e: KeyboardEvent) => {
    const now = Date.now();
    // Hardware scanners type very fast (< 30ms between chars)
    if (now - lastKeyTime > 100) buffer = '';
    lastKeyTime = now;

    if (e.key === 'Enter' && buffer.length > 3) {
      onScan({ raw: buffer, format: 'hardware', timestamp: now });
      buffer = '';
      e.preventDefault();
      return;
    }

    if (e.key.length === 1) buffer += e.key;
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}