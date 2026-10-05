// src/hooks/useDispatch.ts

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc,
  setDoc,
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { Dispatch, Order, ProductionJob } from '../types';
import { sendWhatsAppNotification } from '../utils/whatsapp';

export interface DispatchFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const useDispatchList = (tenantId: string | undefined, filters?: DispatchFilters) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`dispatches_${tenantId}`);
        let list: Dispatch[] = [];
        if (cached) {
          list = JSON.parse(cached);
        } else {
          // Initialize with elegant mock dispatches matching high standards
          list = [
            {
              id: 'disp_9001',
              tenantId,
              orderId: 'order_test_01',
              dispatchNumber: 'DS-9001',
              invoiceNumber: 'INV-F26-9022',
              vehicleNumber: 'MH-12-PQ-9876',
              driverName: 'Sukhdev Singh',
              driverPhone: '9440612345',
              lrNumber: 'LR-890122',
              LRNumber: 'LR-890122',
              transporter: 'SafeExpress Ltd.',
              items: [
                { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', quantity: 20, unitPrice: 4200, gstPercent: 18, total: 84000 }
              ],
              status: 'Dispatched',
              dispatchDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
              dispatchedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
              destination: 'Pune Distribution Hub',
              itemsSummary: 'Forged Steel Spur Gear x20',
              notes: 'Handed over directly with full transport packaging intact.'
            }
          ];
          localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify(list));
        }

        // Apply filters in client memory for sandbox
        let filtered = [...list];
        if (filters?.status && filters.status !== 'All') {
          filtered = filtered.filter(d => d.status.toLowerCase() === filters.status?.toLowerCase());
        }
        if (filters?.startDate) {
          const start = new Date(filters.startDate).getTime();
          filtered = filtered.filter(d => {
            const date = d.dispatchDate ? new Date(d.dispatchDate).getTime() : new Date(d.dispatchedAt).getTime();
            return date >= start;
          });
        }
        if (filters?.endDate) {
          const end = new Date(filters.endDate).getTime() + (24 * 3600 * 1000); // end of day
          filtered = filtered.filter(d => {
            const date = d.dispatchDate ? new Date(d.dispatchDate).getTime() : new Date(d.dispatchedAt).getTime();
            return date <= end;
          });
        }

        setDispatches(filtered);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Sandbox storage connection broken');
        setLoading(false);
      }
    } else {
      try {
        const colPath = `tenants/${tenantId}/dispatches`;
        const qRef = collection(db, 'tenants', tenantId, 'dispatches');
        
        const unsubscribe = onSnapshot(qRef, (snap) => {
          const list: Dispatch[] = [];
          snap.forEach(d => {
            list.push({ id: d.id, ...d.data() } as Dispatch);
          });

          // Apply filters on retrieved real-time list
          let filtered = [...list];
          if (filters?.status && filters.status !== 'All') {
            filtered = filtered.filter(d => d.status.toLowerCase() === filters.status?.toLowerCase());
          }
          if (filters?.startDate) {
            const start = new Date(filters.startDate).getTime();
            filtered = filtered.filter(d => {
              const date = d.dispatchDate ? new Date(d.dispatchDate).getTime() : new Date(d.dispatchedAt).getTime();
              return date >= start;
            });
          }
          if (filters?.endDate) {
            const end = new Date(filters.endDate).getTime() + (24 * 3600 * 1000);
            filtered = filtered.filter(d => {
              const date = d.dispatchDate ? new Date(d.dispatchDate).getTime() : new Date(d.dispatchedAt).getTime();
              return date <= end;
            });
          }

          setDispatches(filtered);
          setLoading(false);
        }, (err) => {
          setError(err.message);
          setLoading(false);
        });

        return unsubscribe;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [tenantId, filters?.status, filters?.startDate, filters?.endDate]);

  return { dispatches, loading, error };
};

export const useDispatchDetail = (tenantId: string | undefined, dispatchId: string | undefined) => {
  const [dispatchItem, setDispatchItem] = useState<Dispatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !dispatchId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      try {
        const cached = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
        const list: Dispatch[] = JSON.parse(cached);
        const item = list.find(d => d.id === dispatchId);
        setDispatchItem(item || null);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    } else {
      try {
        const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'dispatches', dispatchId), (snap) => {
          if (snap.exists()) {
            setDispatchItem({ id: snap.id, ...snap.data() } as Dispatch);
          } else {
            setDispatchItem(null);
          }
          setLoading(false);
        }, (err) => {
          setError(err.message);
          setLoading(false);
        });

        return unsub;
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [tenantId, dispatchId]);

  const updateDispatchStatus = useCallback(async (newStatus: 'Planned' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'shipped' | 'delivered') => {
    if (!tenantId || !dispatchId) return;

    const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

    if (isSandbox) {
      const cached = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
      const list: Dispatch[] = JSON.parse(cached);
      const updated = list.map(d => {
        if (d.id === dispatchId) {
          return { ...d, status: newStatus };
        }
        return d;
      });
      localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify(updated));
      setDispatchItem(prev => prev ? { ...prev, status: newStatus } : null);

      // Optionally advance underlying Order to completed if marked as Delivered/delivered
      if (dispatchItem && (newStatus === 'Delivered' || newStatus === 'delivered')) {
        const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
        const parsedOrders = JSON.parse(cachedOrders) as Order[];
        const updatedOrders = parsedOrders.map(o => o.id === dispatchItem.orderId ? { ...o, status: 'completed' as const } : o);
        localStorage.setItem(`orders_${tenantId}`, JSON.stringify(updatedOrders));
      }
    } else {
      const docRef = doc(db, 'tenants', tenantId, 'dispatches', dispatchId);
      await updateDoc(docRef, { status: newStatus });

      if (dispatchItem && (newStatus === 'Delivered' || newStatus === 'delivered')) {
        const ordersCol = collection(db, 'orders');
        const oSnap = await getDocs(query(ordersCol, where('id', '==', dispatchItem.orderId)));
        if (!oSnap.empty) {
          await updateDoc(doc(db, 'orders', oSnap.docs[0].id), { status: 'completed' });
        }
      }
    }
  }, [tenantId, dispatchId, dispatchItem]);

  return { dispatchItem, loading, error, updateDispatchStatus };
};

export const createDispatchRecord = async (
  tenantId: string, 
  data: Omit<Dispatch, 'id' | 'tenantId' | 'dispatchedAt'>,
  operatorName: string
) => {
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  const dispatchId = `disp_${Date.now().toString().slice(-6)}`;
  const timestamp = new Date().toISOString();

  const newDispatch: Dispatch = {
    ...data,
    id: dispatchId,
    tenantId,
    dispatchedAt: timestamp
  } as any;

  if (isSandbox) {
    // 1. Add dispatch record
    const cached = localStorage.getItem(`dispatches_${tenantId}`) || '[]';
    const list = JSON.parse(cached);
    localStorage.setItem(`dispatches_${tenantId}`, JSON.stringify([newDispatch, ...list]));

    // 2. Update parent order to 'Dispatched' in orders_${tenantId}
    const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
    const parsedOrders = JSON.parse(cachedOrders) as Order[];
    let parentOrderNumber = data.orderId;
    const updatedOrders = parsedOrders.map(o => {
      if (o.id === data.orderId) {
        parentOrderNumber = o.orderNumber;
        return { 
          ...o, 
          status: 'Dispatched' as any,
          dispatchId,
          dispatchedAt: timestamp 
        };
      }
      return o;
    });
    localStorage.setItem(`orders_${tenantId}`, JSON.stringify(updatedOrders));

    // Update customer portal order in all client caches with LR/transporter assignments
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('customer_orders_')) {
        try {
          const cachedCO = localStorage.getItem(key) || '[]';
          const parsedCO = JSON.parse(cachedCO) as any[];
          const hasMatch = parsedCO.some(o => o.id === data.orderId || o.orderNumber === parentOrderNumber || o.convertedToInternalOrderId === data.orderId);
          if (hasMatch) {
            const updatedCO = parsedCO.map(o => {
              if (o.id === data.orderId || o.orderNumber === parentOrderNumber || o.convertedToInternalOrderId === data.orderId) {
                return {
                  ...o,
                  status: 'Dispatched',
                  dispatchId,
                  dispatchedAt: timestamp,
                  transporter: data.transporter,
                  lrNumber: data.lrNumber || (data as any).LRNumber
                };
              }
              return o;
            });
            localStorage.setItem(key, JSON.stringify(updatedCO));
          }
        } catch (e) {
          console.error('Error updating customer portal order in sandbox:', e);
        }
      }
    }

    // 3. Mark matching jobs as 'ready' or fully dispatched
    const cachedJobs = localStorage.getItem(`jobs_${tenantId}`) || '[]';
    const parsedJobs = JSON.parse(cachedJobs) as ProductionJob[];
    const updatedJobs = parsedJobs.map(j => {
      if (j.orderId === data.orderId) {
        return { 
          ...j, 
          currentStage: 'ready' as const, 
          updatedBy: operatorName, 
          updatedAt: timestamp 
        };
      }
      return j;
    });
    localStorage.setItem(`jobs_${tenantId}`, JSON.stringify(updatedJobs));

    // Connected Workflow 5: Order Dispatched -> Inventory Deduction (Sandbox mode)
    await deductInventoryForOrder(tenantId, data.orderId, parentOrderNumber, true);
  } else {
    // Live firestore flow under tenants/{tenantId}/dispatches
    const docRef = doc(db, 'tenants', tenantId, 'dispatches', dispatchId);
    await setDoc(docRef, {
      ...newDispatch,
      dispatchedAt: serverTimestamp()
    });

    // Update parent order status
    const ordersCol = collection(db, 'orders');
    const oSnap = await getDocs(query(ordersCol, where('id', '==', data.orderId)));
    let parentOrderNumberLive = data.orderId;
    if (!oSnap.empty) {
      const parentOrderDoc = oSnap.docs[0];
      parentOrderNumberLive = parentOrderDoc.data().orderNumber || data.orderId;
      await updateDoc(doc(db, 'orders', parentOrderDoc.id), { 
        status: 'Dispatched',
        dispatchId: dispatchId,
        dispatchedAt: serverTimestamp()
      });
    }

    // Update customer portal order under customerOrders in live firestore
    try {
      const portalOrdersCol = collection(db, 'customerOrders');
      let pSnap = await getDocs(query(portalOrdersCol, where('convertedToInternalOrderId', '==', data.orderId)));
      
      if (pSnap.empty && parentOrderNumberLive) {
        pSnap = await getDocs(query(portalOrdersCol, where('orderNumber', '==', parentOrderNumberLive)));
      }

      for (const d of pSnap.docs) {
        await updateDoc(doc(db, 'customerOrders', d.id), {
          status: 'Dispatched',
          dispatchId: dispatchId,
          dispatchedAt: serverTimestamp(),
          transporter: data.transporter,
          lrNumber: data.lrNumber || (data as any).LRNumber || 'N/A'
        });
      }
    } catch (e) {
      console.error('Error updating customer portal order in live Firestore:', e);
    }

    // Update production jobs
    const jobsCol = collection(db, 'productionJobs');
    const jSnap = await getDocs(query(jobsCol, where('orderId', '==', data.orderId)));
    for (const d of jSnap.docs) {
      await updateDoc(doc(db, 'productionJobs', d.id), { 
        currentStage: 'ready',
        updatedBy: operatorName,
        updatedAt: serverTimestamp()
      });
    }

    // Connected Workflow 5: Order Dispatched -> Inventory Deduction (Live Firestore mode)
    await deductInventoryForOrder(tenantId, data.orderId, parentOrderNumberLive, false);
  }

  // Trigger dispatch alert via stubbed WhatsApp alert function
  await sendDispatchWhatsapp(tenantId, newDispatch);

  return newDispatch;
};

// WhatsApp Dispatch Alert
export const sendDispatchWhatsapp = async (tenantId: string, item: Dispatch) => {
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;
  
  let recipientPhone = '';
  let customerName = item.customerName || 'Valued Client';
  let orderNumber = item.orderId; // fallback
  let customerId = item.customerId || '';

  // Get parent order information first
  if (isSandbox) {
    try {
      const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders) as Order[];
      const matchedOrder = parsedOrders.find(o => o.id === item.orderId);
      if (matchedOrder) {
        recipientPhone = matchedOrder.phone || '';
        customerName = matchedOrder.customerName || customerName;
        orderNumber = matchedOrder.orderNumber || orderNumber;
        customerId = (matchedOrder as any).customerId || matchedOrder.createdBy || '';
      }
    } catch (e) {
      console.error('Error fetching parent order in sandbox whatsapp:', e);
    }
  } else {
    try {
      const ordersCol = collection(db, 'orders');
      const oSnap = await getDocs(query(ordersCol, where('id', '==', item.orderId)));
      if (!oSnap.empty) {
        const oData = oSnap.docs[0].data() as Order;
        recipientPhone = oData.phone || '';
        customerName = oData.customerName || customerName;
        orderNumber = oData.orderNumber || orderNumber;
        customerId = (oData as any).customerId || oData.createdBy || '';
      }
    } catch (e) {
      console.error('Error fetching parent order in live whatsapp:', e);
    }
  }

  // Fallback to customer table lookup if phone is still empty
  if (!recipientPhone) {
    if (isSandbox) {
      try {
        const cachedCusts = localStorage.getItem(`customers_${tenantId}`) || '[]';
        const parsedCusts = JSON.parse(cachedCusts);
        const matched = parsedCusts.find((c: any) => c.name.toLowerCase() === customerName.toLowerCase() || c.id === customerId);
        if (matched) {
          recipientPhone = matched.phone || '';
          customerId = matched.id;
        }
      } catch (e) {
        console.error('Error looking up customer in sandbox:', e);
      }
    } else {
      try {
        const custsCol = collection(db, 'tenants', tenantId, 'customers');
        const cSnap = await getDocs(query(custsCol, where('name', '==', customerName)));
        if (!cSnap.empty) {
          recipientPhone = cSnap.docs[0].data().phone || '';
          customerId = cSnap.docs[0].id;
        }
      } catch (e) {
        console.error('Error looking up customer in firestore:', e);
      }
    }
  }

  // Final fallback to driver phone if customer phone is missing
  if (!recipientPhone) {
    recipientPhone = item.driverPhone || '';
  }

  if (!recipientPhone) {
    console.warn('Could not determine recipient phone for Dispatch WhatsApp announcement.');
    return;
  }

  try {
    await sendWhatsAppNotification({
      recipientName: customerName,
      recipientPhone: recipientPhone,
      templateName: 'order_dispatched',
      tenantId,
      orderId: item.orderId,
      customerId: customerId,
      parameters: {
        orderNumber: orderNumber,
        transporterName: item.transporter || 'Direct Truck',
        transporter: item.transporter || 'Direct Truck',
        invoiceNumber: item.invoiceNumber || item.dispatchNumber,
        vehicleNumber: item.vehicleNumber || 'ARRANGED',
        lrNumber: item.lrNumber || item.LRNumber || 'N/A',
        expectedDeliveryDate: item.dispatchDate || 'N/A',
        deliveryDate: item.dispatchDate || 'N/A',
        dispatchDate: item.dispatchDate || 'N/A',
        driverPhone: item.driverPhone || '',
        companyName: 'Ashrey FlowWorks'
      }
    });
  } catch (err) {
    console.warn('Dispatch whatsapp alert warning:', err);
  }
};

/**
 * Connected Workflow 5 Helper: Order Dispatched -> Inventory Deduction
 */
export const deductInventoryForOrder = async (
  tenantId: string,
  orderId: string,
  parentOrderNumber: string,
  isSandbox: boolean
) => {
  try {
    let matchedOrder: Order | null = null;
    if (isSandbox) {
      const cachedOrders = localStorage.getItem(`orders_${tenantId}`) || '[]';
      const parsedOrders = JSON.parse(cachedOrders) as Order[];
      matchedOrder = parsedOrders.find(o => o.id === orderId) || null;
    } else {
      const ordersCol = collection(db, 'orders');
      const oSnap = await getDocs(query(ordersCol, where('id', '==', orderId)));
      if (!oSnap.empty) {
        matchedOrder = { id: oSnap.docs[0].id, ...oSnap.docs[0].data() } as Order;
      }
    }

    if (!matchedOrder || !matchedOrder.items) {
      console.warn('Inventory Deduction: order items not found.');
      return;
    }

    let stockItems: any[] = [];
    const stockKey = `stock_items_${tenantId}`;
    if (isSandbox) {
      const stockItemsCached = localStorage.getItem(stockKey);
      if (stockItemsCached) {
        stockItems = JSON.parse(stockItemsCached);
      } else {
        stockItems = [
          {
            id: 'stock-1',
            tenantId,
            name: 'Wire Rod — High Tensile Steel 8mm',
            code: 'WR-1002',
            category: 'raw_material',
            currentQty: 25.0,
            unit: 'tonnes',
            reorderLevel: 10.0,
            lastUpdated: new Date().toISOString()
          },
          {
            id: 'stock-2',
            tenantId,
            name: 'Forged Crankshaft — FC300 Machined',
            code: 'CS-FC300',
            category: 'finished_goods',
            currentQty: 120,
            unit: 'units',
            reorderLevel: 200,
            lastUpdated: new Date().toISOString()
          },
          {
            id: 'stock-3',
            tenantId,
            name: 'Hydraulic Oil ISO 68 Premium',
            code: 'CO-HO68',
            category: 'consumable',
            currentQty: 45,
            unit: 'litres',
            reorderLevel: 50,
            lastUpdated: new Date().toISOString()
          },
          {
            id: 'stock-4',
            tenantId,
            name: 'M12 Hex Bolts — Grade 8.8 High S',
            code: 'SP-M12B',
            category: 'spare',
            currentQty: 850,
            unit: 'units',
            reorderLevel: 500,
            lastUpdated: new Date().toISOString()
          }
        ];
        localStorage.setItem(stockKey, JSON.stringify(stockItems));
      }
    } else {
      const stockItemsCol = collection(db, 'tenants', tenantId, 'stockItems');
      const stockSnap = await getDocs(stockItemsCol);
      stockItems = stockSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    }

    for (const lineItem of matchedOrder.items) {
      const name = lineItem.name.toLowerCase();
      let matchedStockItem = stockItems.find(s => 
        s.name.toLowerCase().includes(name) || 
        name.includes(s.name.toLowerCase()) ||
        s.code?.toLowerCase() === lineItem.id?.toLowerCase() ||
        s.id === lineItem.id
      );

      if (!matchedStockItem && stockItems.length > 0) {
        matchedStockItem = stockItems.find(s => s.category === 'finished_goods') || stockItems[0];
      }

      if (matchedStockItem) {
        const prevQty = Number(matchedStockItem.currentQty || 0);
        const quantityDeducted = Number(lineItem.quantity || 0);
        const newQty = Math.max(0, prevQty - quantityDeducted);

        matchedStockItem.currentQty = newQty;
        matchedStockItem.lastUpdated = new Date().toISOString();

        const threshold = matchedStockItem.minimumStock !== undefined ? Number(matchedStockItem.minimumStock) : Number(matchedStockItem.reorderLevel || 0);
        const goesBelowMin = newQty < threshold;

        if (isSandbox) {
          const ledgerKey = `ledger_${tenantId}_${matchedStockItem.id}`;
          const ledgerCached = localStorage.getItem(ledgerKey) || '[]';
          const listLedger = JSON.parse(ledgerCached);
          const ledgerEntry = {
            id: `led-${Date.now()}-${Math.random()}`,
            tenantId,
            itemId: matchedStockItem.id,
            timestamp: new Date().toISOString(),
            type: 'order_dispatch',
            orderId,
            quantityDeducted,
            balanceAfter: newQty,
            qty: quantityDeducted,
            qtyAfter: newQty,
            reason: `Dispatch item deduction for Order #${parentOrderNumber || orderId}`,
            updatedBy: 'system',
            updatedByName: 'Automated Dispatch Engine'
          };
          listLedger.unshift(ledgerEntry);
          localStorage.setItem(ledgerKey, JSON.stringify(listLedger));

          if (goesBelowMin) {
            const alertKey = `stockAlerts_${tenantId}`;
            const alertsCached = localStorage.getItem(alertKey) || '[]';
            const listAlerts = JSON.parse(alertsCached);
            const alertId = `alert-${Date.now()}-${Math.random()}`;
            const alertObj = {
              id: alertId,
              tenantId,
              itemId: matchedStockItem.id,
              itemName: matchedStockItem.name,
              itemCode: matchedStockItem.code,
              currentQty: newQty,
              minimumStock: threshold,
              reorderLevel: threshold,
              createdAt: new Date().toISOString(),
              timestamp: new Date().toISOString(),
              status: 'active',
              message: `Low stock alert: ${matchedStockItem.name} is below minimum level (${newQty} remaining).`
            };
            listAlerts.unshift(alertObj);
            localStorage.setItem(alertKey, JSON.stringify(listAlerts));

            try {
              await sendWhatsAppNotification({
                recipientName: 'Stockroom Purchase Manager',
                recipientPhone: '+919876543210',
                templateName: 'low_stock_alert',
                tenantId,
                parameters: {
                  itemName: matchedStockItem.name,
                  currentQty: String(newQty)
                }
              });
            } catch (err) {
              console.warn('Sandbox low stock alert notify error:', err);
            }
          }
        } else {
          const itemDocRef = doc(db, 'tenants', tenantId, 'stockItems', matchedStockItem.id);
          await updateDoc(itemDocRef, {
            currentQty: newQty,
            lastUpdated: serverTimestamp()
          });

          const ledgerColRef = collection(db, 'tenants', tenantId, 'stockItems', matchedStockItem.id, 'ledger');
          const ledgerDocRef = doc(ledgerColRef);
          await setDoc(ledgerDocRef, {
            tenantId,
            itemId: matchedStockItem.id,
            timestamp: serverTimestamp(),
            type: 'order_dispatch',
            orderId,
            quantityDeducted,
            balanceAfter: newQty,
            qty: quantityDeducted,
            qtyAfter: newQty,
            reason: `Dispatch item deduction for Order #${parentOrderNumber || orderId}`,
            updatedBy: 'system',
            updatedByName: 'Automated Dispatch Engine'
          });

          if (goesBelowMin) {
            const alertCol = collection(db, 'stockAlerts');
            const alertDoc = doc(alertCol);
            await setDoc(alertDoc, {
              tenantId,
              itemId: matchedStockItem.id,
              itemName: matchedStockItem.name,
              itemCode: matchedStockItem.code,
              currentQty: newQty,
              minimumStock: threshold,
              reorderLevel: threshold,
              createdAt: serverTimestamp(),
              timestamp: serverTimestamp(),
              status: 'active',
              message: `Low stock alert: ${matchedStockItem.name} is below minimum level (${newQty} remaining).`
            });

            try {
              await sendWhatsAppNotification({
                recipientName: 'Stockroom Purchase Manager',
                recipientPhone: '+919876543210',
                templateName: 'low_stock_alert',
                tenantId,
                parameters: {
                  itemName: matchedStockItem.name,
                  currentQty: String(newQty)
                }
              });
            } catch (err) {
              console.warn('Live low stock alert notify error:', err);
            }
          }
        }
      }
    }

    if (isSandbox) {
      localStorage.setItem(stockKey, JSON.stringify(stockItems));
    }
  } catch (error) {
    console.error('Error in deductInventoryForOrder workflow:', error);
  }
};
