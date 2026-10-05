// src/hooks/useDashboardData.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { RFQ, Quote, Order, ProductionJob, Dispatch, Invoice, DashboardSummary, OverdueJobSummary } from '../types';

export const useDashboardData = (tenantId: string | undefined, isSandboxMode: boolean) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [triggerVal, setTriggerVal] = useState<number>(0);

  const refetch = useCallback(() => {
    setTriggerVal((prev) => prev + 1);
  }, []);

  const parseTimestampToDate = (ts: any): Date | null => {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  };

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Sandbox (LocalStorage) Execution Pipeline
    if (isSandboxMode) {
      try {
        const loadSandboxData = () => {
          const cachedRfqs = localStorage.getItem(`rfqs_${tenantId}`) || '[]';
          const cachedQuotes = localStorage.getItem(`quotes_${tenantId}`) || '[]';
          const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
          const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
          const cachedDispatches = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
          const cachedInvoices = localStorage.getItem(`invoices_${tenantId}`) || '[]';
          const cachedStockItems = localStorage.getItem(`stock_items_${tenantId}`) || '[]';
          const cachedActivities = localStorage.getItem(`activity_logs_${tenantId}`) || '[]';

          const rfqs: RFQ[] = JSON.parse(cachedRfqs);
          const quotes: Quote[] = JSON.parse(cachedQuotes);
          const orders: Order[] = JSON.parse(cachedOrders);
          const jobs: ProductionJob[] = JSON.parse(cachedJobs);
          const dispatches: Dispatch[] = JSON.parse(cachedDispatches);
          const invoices: Invoice[] = JSON.parse(cachedInvoices);
          const stockItems: any[] = JSON.parse(cachedStockItems);
          let activities: any[] = JSON.parse(cachedActivities);

          // Add default activity logs if none exist for visuals stability
          if (activities.length === 0) {
            activities = [
              {
                id: 'act_1',
                actionType: 'create',
                entityType: 'rfq',
                entityId: 'RFQ-7890',
                tenantId,
                actor: { displayName: 'Hitesh Chandra (Sales)' },
                timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                description: 'Registered inbound inquiry for High Tensile Steel Pipes — RFQ #RFQ-7890'
              },
              {
                id: 'act_2',
                actionType: 'update',
                entityType: 'job',
                entityId: 'JOB-202',
                tenantId,
                actor: { displayName: 'Devendra Gowde (CNC Master)' },
                timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                description: 'Order #ORD-1049 moved to CNS Machining station'
              },
              {
                id: 'act_3',
                actionType: 'create',
                entityType: 'dispatch',
                entityId: 'DSP-9041',
                tenantId,
                actor: { displayName: 'Sukhdev Singh (Logistics)' },
                timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
                description: 'Lorry MH-12-PQ-9876 dispatched to Pune Distribution Hub'
              },
              {
                id: 'act_4',
                actionType: 'create',
                entityType: 'invoice',
                entityId: 'INV-1002',
                tenantId,
                actor: { displayName: 'Automated Billing' },
                timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
                description: 'Dispatched notification sent. Outstanding balance of ₹1,45,000 billed.'
              }
            ];
            localStorage.setItem(`activity_logs_${tenantId}`, JSON.stringify(activities));
          }

          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const todayDateStr = now.toDateString();
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);

          // 1. Open RFQs (status !== "Won" and !== "Lost")
          const openRfqs = rfqs.filter((r) => {
            const status = r.status?.toLowerCase();
            return status !== 'won' && status !== 'lost';
          });
          const openRfqsCount = openRfqs.length;

          // 2. Quotations Pending (RFQs where quotation is sent but no response) -> status === 'quoted'
          const quotesPendingCount = rfqs.filter((r) => {
            const status = r.status?.toLowerCase();
            return status === 'quoted';
          }).length;

          // 3. Orders in Production (status other than "Dispatched" and "Cancelled")
          const ordersInProduction = orders.filter((o) => {
            const status = o.status?.toLowerCase();
            return status !== 'dispatched' && status !== 'cancelled' && status !== 'completed';
          });
          const ordersInProductionCount = ordersInProduction.length;

          // 4. Dispatches Today (dispatchedAt or dispatchDate = today)
          const dispatchesTodayCount = dispatches.filter((d) => {
            if (!d.dispatchedAt && !d.dispatchDate) return false;
            const dispatchDateObj = d.dispatchDate ? new Date(d.dispatchDate) : parseTimestampToDate(d.dispatchedAt);
            if (!dispatchDateObj) return false;
            return dispatchDateObj.toDateString() === todayDateStr;
          }).length;

          // 5. Overdue Payments (dueDate < today and status = "Pending")
          const overduePaymentsCount = invoices.filter((inv) => {
            const isOverdueDate = inv.dueDate && inv.dueDate < todayStr;
            const statusLower = inv.status?.toLowerCase() || '';
            return isOverdueDate && (
              statusLower === 'pending' || 
              statusLower === 'overdue' || 
              (statusLower !== 'paid' && Number(inv.outstanding || 0) > 0)
            );
          }).length;

          // 6. Low Stock Items (quantity < minimumStock)
          const lowStockItemsCount = stockItems.filter((item) => {
            const qty = Number(item.currentQty || 0);
            const minStock = item.minimumStock !== undefined ? Number(item.minimumStock) : Number(item.reorderLevel || 0);
            return qty < minStock;
          }).length;

          // 7. Orders in production by stage
          const stageCounts = {
            cutting: 0,
            welding: 0,
            machining: 0,
            assembly: 0,
            quality_check: 0,
            ready: 0
          };

          const activeOrderIds = new Set(
            orders
              .filter((o) => ['pending', 'in-production', 'produced'].includes(o.status))
              .map((o) => o.id)
          );

          jobs.forEach((j) => {
            if (activeOrderIds.has(j.orderId) && j.currentStage && stageCounts[j.currentStage as keyof typeof stageCounts] !== undefined) {
              stageCounts[j.currentStage as keyof typeof stageCounts]++;
            }
          });

          // Dispatches due today (calendar planned)
          const dispatchesDueTodayCount = orders.filter((o) => {
            const isActiveOrder = ['pending', 'in-production', 'produced'].includes(o.status);
            return isActiveOrder && o.deliveryDate === todayStr;
          }).length;

          // Overdue jobs past planned end date
          const overdueOrders = orders.filter((o) => {
            const isActiveOrder = ['pending', 'in-production', 'produced'].includes(o.status);
            return isActiveOrder && o.deliveryDate && o.deliveryDate < todayStr;
          });
          const overdueJobsCount = overdueOrders.length;

          // Top 5 Open RFQs by age (oldest first)
          const topOpenRfqs = [...openRfqs]
            .sort((a, b) => {
              const dateA = parseTimestampToDate(a.createdAt)?.getTime() || 0;
              const dateB = parseTimestampToDate(b.createdAt)?.getTime() || 0;
              return dateA - dateB;
            })
            .slice(0, 5);

          // Overdue Jobs List mapping
          const overdueJobsList: OverdueJobSummary[] = overdueOrders.map((o) => {
            const relatedJob = jobs.find((j) => j.orderId === o.id);
            const delivery = o.deliveryDate ? new Date(o.deliveryDate) : new Date();
            const timeDiff = now.getTime() - delivery.getTime();
            const overdueDays = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24)));

            const mainItemName = o.items?.[0]?.name || 'Industrial Castings';
            const mainQty = o.items?.[0]?.quantity || 1;

            return {
              orderId: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              itemName: mainItemName,
              quantity: mainQty,
              deliveryDate: o.deliveryDate || '',
              overdueDays,
              currentStage: relatedJob?.currentStage
            };
          }).sort((a, b) => b.overdueDays - a.overdueDays);

          // Recent Activity Feed (last 10 events)
          const recentActivitiesFeed = [...activities]
            .sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              return timeB - timeA;
            })
            .slice(0, 10);

          setSummary({
            openRfqsCount,
            quotesSentLast7DaysCount: quotes.filter((q) => {
              if (q.status !== 'sent') return false;
              const created = parseTimestampToDate(q.createdAt);
              if (!created) return false;
              return created >= sevenDaysAgo && created <= now;
            }).length,
            quotesPendingCount,
            ordersInProductionCount,
            dispatchesTodayCount,
            overduePaymentsCount,
            lowStockItemsCount,
            ordersInProductionByStage: stageCounts,
            dispatchesDueTodayCount,
            overdueJobsCount,
            topOpenRfqs,
            overdueJobs: overdueJobsList,
            recentActivities: recentActivitiesFeed
          });
          setLoading(false);
        };

        loadSandboxData();
      } catch (err: any) {
        setError(err?.message || 'Error processing sandbox analytics');
        setLoading(false);
      }
    } else {
      // Production Firestore Live Sync Channel
      setLoading(true);
      setError(null);

      let unsubRfqs: () => void = () => {};
      let unsubQuotes: () => void = () => {};
      let unsubOrders: () => void = () => {};
      let unsubJobs: () => void = () => {};
      let unsubDispatches: () => void = () => {};
      let unsubInvoices: () => void = () => {};
      let unsubStockItems: () => void = () => {};
      let unsubActivities: () => void = () => {};

      try {
        let syncedRfqs: RFQ[] = [];
        let syncedQuotes: Quote[] = [];
        let syncedOrders: Order[] = [];
        let syncedJobs: ProductionJob[] = [];
        let syncedDispatches: Dispatch[] = [];
        let syncedInvoices: Invoice[] = [];
        let syncedStockItems: any[] = [];
        let syncedActivities: any[] = [];

        // Counter to track sync completion
        let collectionsLoaded = 0;
        const checkAndAggregate = () => {
          collectionsLoaded++;
          if (collectionsLoaded < 8) return; // Wait for all 8 live listeners to initialize first

          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          const todayDateStr = now.toDateString();
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);

          // 1. Open RFQs (status !== "Won" and !== "Lost")
          const openRfqs = syncedRfqs.filter((r) => {
            const status = r.status?.toLowerCase();
            return status !== 'won' && status !== 'lost';
          });
          const openRfqsCount = openRfqs.length;

          // 2. Quotations Pending (status === 'quoted')
          const quotesPendingCount = syncedRfqs.filter((r) => {
            const status = r.status?.toLowerCase();
            return status === 'quoted';
          }).length;

          // 3. Orders in Production (status other than Dispatched and Cancelled)
          const ordersInProductionCount = syncedOrders.filter((o) => {
            const status = o.status?.toLowerCase();
            return status !== 'dispatched' && status !== 'cancelled' && status !== 'completed';
          }).length;

          // 4. Dispatches Today (dispatchedAt or dispatchDate = today date)
          const dispatchesTodayCount = syncedDispatches.filter((d) => {
            if (!d.dispatchedAt && !d.dispatchDate) return false;
            const dispatchDateObj = d.dispatchDate ? new Date(d.dispatchDate) : parseTimestampToDate(d.dispatchedAt);
            if (!dispatchDateObj) return false;
            return dispatchDateObj.toDateString() === todayDateStr;
          }).length;

          // 5. Overdue Payments (dueDate < today && status = Pending)
          const overduePaymentsCount = syncedInvoices.filter((inv) => {
            const isOverdueDate = inv.dueDate && inv.dueDate < todayStr;
            const statusLower = inv.status?.toLowerCase() || '';
            return isOverdueDate && (
              statusLower === 'pending' || 
              statusLower === 'overdue' || 
              (statusLower !== 'paid' && Number(inv.outstanding || 0) > 0)
            );
          }).length;

          // 6. Low Stock Items (quantity < minimumStock)
          const lowStockItemsCount = syncedStockItems.filter((item) => {
            const qty = Number(item.currentQty || 0);
            const minStock = item.minimumStock !== undefined ? Number(item.minimumStock) : Number(item.reorderLevel || 0);
            return qty < minStock;
          }).length;

          // 7. Stage Counts
          const stageCounts = {
            cutting: 0,
            welding: 0,
            machining: 0,
            assembly: 0,
            quality_check: 0,
            ready: 0
          };

          const activeOrderIds = new Set(
            syncedOrders
              .filter((o) => ['pending', 'in-production', 'produced'].includes(o.status))
              .map((o) => o.id)
          );

          syncedJobs.forEach((j) => {
            if (activeOrderIds.has(j.orderId) && j.currentStage && stageCounts[j.currentStage as keyof typeof stageCounts] !== undefined) {
              stageCounts[j.currentStage as keyof typeof stageCounts]++;
            }
          });

          // Dispatches Due Today
          const dispatchesDueTodayCount = syncedOrders.filter((o) => {
            const isActiveOrder = ['pending', 'in-production', 'produced'].includes(o.status);
            return isActiveOrder && o.deliveryDate === todayStr;
          }).length;

          // Overdue
          const overdueOrders = syncedOrders.filter((o) => {
            const isActiveOrder = ['pending', 'in-production', 'produced'].includes(o.status);
            return isActiveOrder && o.deliveryDate && o.deliveryDate < todayStr;
          });
          const overdueJobsCount = overdueOrders.length;

          // Top 5 Open RFQs by age (oldest first)
          const topOpenRfqs = [...openRfqs]
            .sort((a, b) => {
              const dateA = parseTimestampToDate(a.createdAt)?.getTime() || 0;
              const dateB = parseTimestampToDate(b.createdAt)?.getTime() || 0;
              return dateA - dateB;
            })
            .slice(0, 5);

          // Overdue Job List Mapping
          const overdueJobsList: OverdueJobSummary[] = overdueOrders.map((o) => {
            const relatedJob = syncedJobs.find((j) => j.orderId === o.id);
            const delivery = o.deliveryDate ? new Date(o.deliveryDate) : new Date();
            const timeDiff = now.getTime() - delivery.getTime();
            const overdueDays = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24)));

            const mainItemName = o.items?.[0]?.name || 'Industrial Component';
            const mainQty = o.items?.[0]?.quantity || 1;

            return {
              orderId: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              itemName: mainItemName,
              quantity: mainQty,
              deliveryDate: o.deliveryDate || '',
              overdueDays,
              currentStage: relatedJob?.currentStage
            };
          }).sort((a, b) => b.overdueDays - a.overdueDays);

          // Recent Activity Feed Mapping (last 10 events)
          const recentActivitiesFeed = [...syncedActivities]
            .sort((a, b) => {
              const timeA = new Date(a.timestamp).getTime();
              const timeB = new Date(b.timestamp).getTime();
              return timeB - timeA;
            })
            .slice(0, 10);

          setSummary({
            openRfqsCount,
            quotesSentLast7DaysCount: syncedQuotes.filter((q) => {
              if (q.status !== 'sent') return false;
              const created = parseTimestampToDate(q.createdAt);
              if (!created) return false;
              return created >= sevenDaysAgo && created <= now;
            }).length,
            quotesPendingCount,
            ordersInProductionCount,
            dispatchesTodayCount,
            overduePaymentsCount,
            lowStockItemsCount,
            ordersInProductionByStage: stageCounts,
            dispatchesDueTodayCount,
            overdueJobsCount,
            topOpenRfqs,
            overdueJobs: overdueJobsList,
            recentActivities: recentActivitiesFeed
          });
          setLoading(false);
        };

        // 1. RFQs
        unsubRfqs = onSnapshot(
          query(collection(db, 'rfqs'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: RFQ[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as RFQ);
            });
            syncedRfqs = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to RFQ lists');
            setLoading(false);
          }
        );

        // 2. Quotes
        unsubQuotes = onSnapshot(
          query(collection(db, 'quotes'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: Quote[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Quote);
            });
            syncedQuotes = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to quotes data');
            setLoading(false);
          }
        );

        // 3. Orders
        unsubOrders = onSnapshot(
          query(collection(db, 'orders'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: Order[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Order);
            });
            syncedOrders = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to orders ledger');
            setLoading(false);
          }
        );

        // 4. Jobs
        unsubJobs = onSnapshot(
          query(collection(db, 'productionJobs'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: ProductionJob[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as ProductionJob);
            });
            syncedJobs = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to shopfloor logs');
            setLoading(false);
          }
        );

        // 5. Dispatches
        unsubDispatches = onSnapshot(
          collection(db, 'tenants', tenantId, 'dispatches'),
          (snapshot) => {
            const list: Dispatch[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Dispatch);
            });
            syncedDispatches = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to dispatches');
            setLoading(false);
          }
        );

        // 6. Invoices
        unsubInvoices = onSnapshot(
          query(collection(db, 'invoices'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: Invoice[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
            });
            syncedInvoices = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to invoices');
            setLoading(false);
          }
        );

        // 7. Stock Items
        unsubStockItems = onSnapshot(
          collection(db, 'tenants', tenantId, 'stockItems'),
          (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() });
            });
            syncedStockItems = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to stockItems');
            setLoading(false);
          }
        );

        // 8. Activity Logs
        unsubActivities = onSnapshot(
          query(collection(db, 'activityLog'), where('tenantId', '==', tenantId)),
          (snapshot) => {
            const list: any[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() });
            });
            syncedActivities = list;
            if (collectionsLoaded >= 8) collectionsLoaded = 7;
            checkAndAggregate();
          },
          (err) => {
            setError(err.message || 'Error subscribing to activity logs');
            setLoading(false);
          }
        );

      } catch (err: any) {
        setError(err?.message || 'Error initiating secure Firestore tunnels');
        setLoading(false);
      }

      // Return unified cleanup callback
      return () => {
        unsubRfqs();
        unsubQuotes();
        unsubOrders();
        unsubJobs();
        unsubDispatches();
        unsubInvoices();
        unsubStockItems();
        unsubActivities();
      };
    }
  }, [tenantId, isSandboxMode, triggerVal]);

  return { summary, loading, error, refetch };
};
