// src/hooks/useEWayBillExpiryMonitor.ts

import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '../context/ToastContext';
import { EWayBillService } from '../services/ewayBillService';

/**
 * Background job that checks for expiring e-Way Bills (within 4 hours of expiry)
 * and notifies the dispatch team per Acceptance Criteria.
 */
export function useEWayBillExpiryMonitor(intervalMs = 60000) {
  const { tenant, profile } = useAuth();
  const { toastError, toastSuccess } = useToast();
  const notifiedSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tenant?.id) return;

    const userRole = (profile?.role || '').toLowerCase();
    const isDispatchStaff = ['admin', 'dispatch', 'management', 'super_admin', 'store_keeper'].includes(userRole);
    if (!isDispatchStaff) return;

    const runCheck = () => {
      try {
        const result = EWayBillService.checkExpiringEWayBills(tenant.id);

        result.alerts.forEach(alert => {
          const key = `${alert.ewbNumber}_${alert.status}`;
          if (!notifiedSetRef.current.has(key)) {
            notifiedSetRef.current.add(key);

            if (alert.status === 'expired') {
              toastError(
                'e-Way Bill Expired!',
                `EWB #${alert.ewbNumber} has expired mid-transit. Extend validity immediately to prevent vehicle seizure.`
              );
            } else if (alert.status === 'expiring_soon') {
              toastError(
                'e-Way Bill Expiring Soon',
                `EWB #${alert.ewbNumber} expires in ${alert.hoursLeft} hours! Check vehicle location and extend if needed.`
              );
            }
          }
        });
      } catch (e) {
        console.warn('e-Way Bill expiry background check failed', e);
      }
    };

    // Run on mount
    runCheck();

    // Set recurring timer
    const interval = setInterval(runCheck, intervalMs);

    return () => clearInterval(interval);
  }, [tenant?.id, profile?.role, intervalMs, toastError]);
}
