// src/services/syncEngine.ts
/**
 * Offline-First Sync Engine
 * ─────────────────────────
 * - Writes go to a local IndexedDB store immediately (optimistic).
 * - A durable "outbox" queue holds pending mutations.
 * - On reconnect, the outbox is flushed to Firestore in order.
 * - Conflict resolution: last-write-wins by server timestamp,
 *   with a manual override hook for critical fields.
 */

import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ─── Types ─────────────────────────────────────────────────────

export interface OutboxEntry {
  id: string;                       // uuid
  collection: string;               // "tenants/{tid}/plants"
  docId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  createdAt: number;                // epoch ms
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  isSyncing: boolean;
}

// ─── IndexedDB Helper ──────────────────────────────────────────

const DB_NAME = 'flowops_offline';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const CACHE_STORE = 'cache';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Sync Engine Class ─────────────────────────────────────────

class SyncEngine {
  private outbox: OutboxEntry[] = [];
  private listeners: Set<(state: SyncState) => void> = new Set();
  private _isOnline = navigator.onLine;
  private _isSyncing = false;
  private _lastSyncedAt: number | null = null;

  constructor() {
    this.loadOutbox();
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());
  }

  // ── Public API ──────────────────────────────────────────────

  /** Write a document locally + enqueue for sync. */
  async write(collectionPath: string, docId: string, payload: Record<string, any>): Promise<void> {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      collection: collectionPath,
      docId,
      operation: 'update',
      payload: { ...payload, _localUpdatedAt: Date.now() },
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.outbox.push(entry);
    await idbPut(OUTBOX_STORE, entry);

    // Optimistically cache locally
    await idbPut(CACHE_STORE, { key: `${collectionPath}/${docId}`, data: entry.payload, updatedAt: Date.now() });

    this.emit();
    if (this._isOnline) this.flush();
  }

  /** Create a new document (ID generated client-side). */
  async create(collectionPath: string, docId: string, payload: Record<string, any>): Promise<void> {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      collection: collectionPath,
      docId,
      operation: 'create',
      payload: { ...payload, _localCreatedAt: Date.now() },
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.outbox.push(entry);
    await idbPut(OUTBOX_STORE, entry);
    await idbPut(CACHE_STORE, { key: `${collectionPath}/${docId}`, data: entry.payload, updatedAt: Date.now() });

    this.emit();
    if (this._isOnline) this.flush();
  }

  /** Delete a document. */
  async delete(collectionPath: string, docId: string): Promise<void> {
    const entry: OutboxEntry = {
      id: crypto.randomUUID(),
      collection: collectionPath,
      docId,
      operation: 'delete',
      payload: {},
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.outbox.push(entry);
    await idbPut(OUTBOX_STORE, entry);

    this.emit();
    if (this._isOnline) this.flush();
  }

  /** Read from local cache first. */
  async read<T>(collectionPath: string, docId: string): Promise<T | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(`${collectionPath}/${docId}`);
      req.onsuccess = () => resolve(req.result?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /** Subscribe to sync state changes. */
  subscribe(listener: (state: SyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): SyncState {
    return {
      isOnline: this._isOnline,
      pendingCount: this.outbox.length,
      lastSyncedAt: this._lastSyncedAt,
      isSyncing: this._isSyncing,
    };
  }

  // ── Internals ───────────────────────────────────────────────

  private async loadOutbox() {
    try {
      this.outbox = await idbGetAll<OutboxEntry>(OUTBOX_STORE);
      this.outbox = this.outbox.filter(e => e.status === 'pending');
      this.emit();
      if (this._isOnline && this.outbox.length > 0) this.flush();
    } catch (e) {
      console.error('[SyncEngine] Failed to load outbox:', e);
    }
  }

  private onOnline() {
    this._isOnline = true;
    this.emit();
    this.flush();
  }

  private onOffline() {
    this._isOnline = false;
    this.emit();
  }

  private emit() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  async flush(): Promise<void> {
    if (this._isSyncing || !this._isOnline || this.outbox.length === 0) return;
    this._isSyncing = true;
    this.emit();

    const toProcess = [...this.outbox].sort((a, b) => a.createdAt - b.createdAt);

    for (const entry of toProcess) {
      try {
        entry.status = 'syncing';
        await this.executeEntry(entry);
        this.outbox = this.outbox.filter(e => e.id !== entry.id);
        await idbDelete(OUTBOX_STORE, entry.id);
      } catch (err: any) {
        entry.retryCount += 1;
        entry.status = entry.retryCount >= 5 ? 'failed' : 'pending';
        entry.error = err?.message || 'Unknown error';
        await idbPut(OUTBOX_STORE, entry);
        if (entry.status === 'failed') {
          console.error('[SyncEngine] Entry permanently failed:', entry);
        }
      }
    }

    this._isSyncing = false;
    this._lastSyncedAt = Date.now();
    this.emit();
  }

  private async executeEntry(entry: OutboxEntry): Promise<void> {
    const segments = entry.collection.split('/').filter(Boolean);
    const ref = doc(db, entry.collection, entry.docId);

    switch (entry.operation) {
      case 'create':
      case 'update':
        await setDoc(ref, { ...entry.payload, updatedAt: serverTimestamp() }, { merge: true });
        break;
      case 'delete':
        await deleteDoc(ref);
        break;
    }
  }
}

export const syncEngine = new SyncEngine();