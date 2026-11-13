// src/hooks/useOnlineStatus.ts

import { useState, useEffect, useCallback, useRef } from 'react';

export interface QueuedShopFloorAction {
  id: string;
  type: 'start_job' | 'advance_job' | 'hold_job' | 'log_downtime' | 'resolve_downtime' | 'sign_off_shift';
  payload: any;
  timestamp: string;
  description: string;
}

const OFFLINE_QUEUE_KEY = 'flowops_offline_actions_queue_v1';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [queuedActions, setQueuedActions] = useState<QueuedShopFloorAction[]>(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync state to localStorage whenever queuedActions change
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queuedActions));
    } catch (e) {
      console.warn('[useOnlineStatus] Failed to cache queue to localStorage', e);
    }
  }, [queuedActions]);

  // Flush queued actions when internet connectivity restores
  const flushQueue = useCallback(async () => {
    if (queuedActions.length === 0 || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      console.log(`[useOnlineStatus] Flushing ${queuedActions.length} queued shop-floor actions...`);
      // Simulate/perform async batch processing of queued actions
      await new Promise(resolve => setTimeout(resolve, 800));

      // Dispatch event to notify other parts of app that background queue synced
      window.dispatchEvent(new CustomEvent('flowops:offline_queue_flushed', {
        detail: { count: queuedActions.length }
      }));

      setQueuedActions([]);
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (err) {
      console.error('[useOnlineStatus] Error flushing offline queue', err);
    } finally {
      setIsSyncing(false);
    }
  }, [queuedActions]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check if we came back online with pending actions
    if (navigator.onLine && queuedActions.length > 0) {
      flushQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue, queuedActions.length]);

  const queueAction = useCallback((action: Omit<QueuedShopFloorAction, 'id' | 'timestamp'>) => {
    const item: QueuedShopFloorAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString()
    };
    setQueuedActions(prev => [...prev, item]);
    return item;
  }, []);

  return {
    isOnline,
    isSyncing,
    queuedActionsCount: queuedActions.length,
    queuedActions,
    queueAction,
    flushQueue
  };
}
