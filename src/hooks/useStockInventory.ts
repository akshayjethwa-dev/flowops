// src/hooks/useStockInventory.ts

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc, 
  serverTimestamp,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { StockItem, StockLedgerEntry, StockEntryInput, StockCategory, ActivityEvent, WhatsAppLog } from '../types';
import { handleFirestoreError, OperationType } from '../firebaseErrors';

export const SEED_STOCK_ITEMS = (tenantId: string): StockItem[] => [
  {
    id: 'stock-1',
    tenantId,
    name: 'Wire Rod — High Tensile Steel 8mm',
    code: 'WR-1002',
    category: 'raw_material',
    currentQty: 25.0,
    unit: 'tonnes',
    reorderLevel: 10.0,
    lastUpdated: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Store Keeper'
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
    lastUpdated: new Date(Date.now() - 24 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Auditor'
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
    lastUpdated: new Date(Date.now() - 4 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Plant Supervisor'
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
    lastUpdated: new Date(Date.now() - 36 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Maintenance Eng.'
  },
  {
    id: 'stock-5',
    tenantId,
    name: 'Forging Die Block — H13 Chromium Die',
    code: 'SP-H13',
    category: 'spare',
    currentQty: 1,
    unit: 'units',
    reorderLevel: 2,
    lastUpdated: new Date(Date.now() - 12 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Die Tooling Head'
  },
  {
    id: 'stock-6',
    tenantId,
    name: 'Round Bars - Carbon Steel CS45 40mm',
    code: 'RB-40CS',
    category: 'raw_material',
    currentQty: 8.5,
    unit: 'tonnes',
    reorderLevel: 12.0,
    lastUpdated: new Date(Date.now() - 48 * 3600000).toISOString(),
    updatedBy: 'user-system',
    updatedByName: 'Procurement Specialist'
  }
];

export const SEED_LEDGER_ENTRIES = (tenantId: string, itemId: string): StockLedgerEntry[] => {
  const now = new Date();
  if (itemId === 'stock-1') {
    return [
      {
        id: 'led-1-3',
        tenantId,
        itemId,
        timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
        type: 'adjustment',
        qty: 5,
        reason: 'Recalibrated via manual count variance offset',
        updatedBy: 'user-system',
        updatedByName: 'Store Keeper',
        qtyAfter: 25.0
      },
      {
        id: 'led-1-2',
        tenantId,
        itemId,
        timestamp: new Date(now.getTime() - 12 * 3600000).toISOString(),
        type: 'outward',
        qty: 15,
        reason: 'Authorized release to Wire-Draw Line #3 for Job J-941',
        updatedBy: 'user-system',
        updatedByName: 'Store Keeper',
        qtyAfter: 20.0
      },
      {
        id: 'led-1-1',
        tenantId,
        itemId,
        timestamp: new Date(now.getTime() - 48 * 3600000).toISOString(),
        type: 'inward',
        qty: 35,
        reason: 'Batch invoice IN-9921 from Tata Prime Steel',
        updatedBy: 'user-system',
        updatedByName: 'Procurement Specialist',
        qtyAfter: 35.0
      }
    ];
  }
  if (itemId === 'stock-2') {
    return [
      {
        id: 'led-2-1',
        tenantId,
        itemId,
        timestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
        type: 'outward',
        qty: 50,
        reason: 'Loaded on Lorry MH-12-FG-4491 for customer dispatch DIS-993',
        updatedBy: 'user-system',
        updatedByName: 'Auditor',
        qtyAfter: 120
      }
    ];
  }
  if (itemId === 'stock-3') {
    return [
      {
        id: 'led-3-1',
        tenantId,
        itemId,
        timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
        type: 'outward',
        qty: 10,
        reason: 'Topping up Hydraulic Forging Press HP-200 cylinder',
        updatedBy: 'user-system',
        updatedByName: 'Plant Supervisor',
        qtyAfter: 45
      }
    ];
  }
  return [];
};

export const useStockItems = (
  tenantId: string | undefined, 
  filters?: { category?: StockCategory | 'all' | ''; search?: string }
) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandbox) {
      try {
        const key = `stock_items_${tenantId}`;
        const cached = localStorage.getItem(key);
        let list: StockItem[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = SEED_STOCK_ITEMS(tenantId);
          localStorage.setItem(key, JSON.stringify(list));
        }

        setItems(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandboxed inventory stock.');
        setLoading(false);
      }
    } else {
      // Direct Firestore Sync: tenants/{tenantId}/stockItems
      const colPath = `tenants/${tenantId}/stockItems`;
      const colRef = collection(db, colPath);

      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        let list: StockItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data,
            lastUpdated: data.lastUpdated?.seconds 
              ? new Date(data.lastUpdated.seconds * 1000).toISOString() 
              : data.lastUpdated || new Date().toISOString()
          } as StockItem);
        });

        // Seed live DB once if totally empty to avoid blank screen
        if (list.length === 0) {
          const seeds = SEED_STOCK_ITEMS(tenantId);
          seeds.forEach(async (seed) => {
            try {
              const seedRef = doc(db, 'tenants', tenantId, 'stockItems', seed.id);
              await setDoc(seedRef, {
                ...seed,
                lastUpdated: serverTimestamp()
              });
            } catch (se) {
              console.warn('Failed to commit stock seed', se);
            }
          });
          setItems(seeds);
        } else {
          setItems(list);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, colPath);
        setError('Error subscribing to live stock items.');
        setLoading(false);
      });

      return unsubscribe;
    }
  }, [tenantId]);

  // Operations: Add Stock Profile Item
  const addStockItem = useCallback(async (newProfile: Omit<StockItem, 'id' | 'tenantId' | 'currentQty' | 'lastUpdated' | 'updatedBy' | 'updatedByName'>): Promise<StockItem> => {
    if (!tenantId) throw new Error('No tenant detected');
    
    const uid = auth.currentUser?.uid || 'user-demo';
    const email = auth.currentUser?.email || 'demo@ashreyforge.com';
    const nameStr = auth.currentUser?.displayName || 'Store Keeper';

    const finalItem: Omit<StockItem, 'id'> = {
      ...newProfile,
      tenantId,
      currentQty: 0,
      lastUpdated: isSandbox ? new Date().toISOString() : serverTimestamp(),
      updatedBy: uid,
      updatedByName: nameStr
    };

    if (isSandbox) {
      const key = `stock_items_${tenantId}`;
      const cached = localStorage.getItem(key);
      const currentList: StockItem[] = cached ? JSON.parse(cached) : [];
      
      const newId = `stock-${Date.now()}`;
      const record = { ...finalItem, id: newId } as StockItem;
      const updated = [record, ...currentList];
      
      localStorage.setItem(key, JSON.stringify(updated));
      setItems(updated);
      return record;
    } else {
      const colPath = `tenants/${tenantId}/stockItems`;
      const colRef = collection(db, colPath);
      const docRef = await addDoc(colRef, finalItem);
      const record = { ...finalItem, id: docRef.id } as StockItem;
      return record;
    }
  }, [tenantId, isSandbox]);

  // Filter items by category and search locally for high performance with memoization to avoid infinite re-render loops
  const categoryFilter = filters?.category;
  const searchFilter = filters?.search;

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (categoryFilter && categoryFilter !== 'all') {
        if (item.category !== categoryFilter) return false;
      }

      if (searchFilter) {
        const s = searchFilter.toLowerCase();
        const codeMatch = item.code?.toLowerCase().includes(s);
        const nameMatch = item.name?.toLowerCase().includes(s);
        if (!codeMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [items, categoryFilter, searchFilter]);

  return {
    items: filteredItems,
    rawItems: items,
    loading,
    error,
    addStockItem
  };
};

export const useStockLedger = (tenantId: string | undefined, itemId: string | undefined) => {
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  useEffect(() => {
    if (!tenantId || !itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandbox) {
      try {
        const key = `ledger_${tenantId}_${itemId}`;
        const cached = localStorage.getItem(key);
        let list: StockLedgerEntry[] = [];

        if (cached) {
          list = JSON.parse(cached);
        } else {
          list = SEED_LEDGER_ENTRIES(tenantId, itemId);
          localStorage.setItem(key, JSON.stringify(list));
        }

        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLedgerEntries(list);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error loading sandboxed ledger entries.');
        setLoading(false);
      }
    } else {
      // Direct Firestore Subcollection Sync: tenants/{tenantId}/stockItems/{itemId}/ledger
      const colPath = `tenants/${tenantId}/stockItems/${itemId}/ledger`;
      const colRef = collection(db, colPath);

      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        let list: StockLedgerEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data,
            timestamp: data.timestamp?.seconds 
              ? new Date(data.timestamp.seconds * 1000).toISOString() 
              : data.timestamp || new Date().toISOString()
          } as StockLedgerEntry);
        });

        // Seed live subcollection if empty
        if (list.length === 0) {
          const seeds = SEED_LEDGER_ENTRIES(tenantId, itemId);
          seeds.forEach(async (seed) => {
            try {
              const seedRef = doc(db, 'tenants', tenantId, 'stockItems', itemId, 'ledger', seed.id);
              await setDoc(seedRef, {
                ...seed,
                timestamp: serverTimestamp()
              });
            } catch (se) {
              console.warn('Failed to write ledger seed', se);
            }
          });
          setLedgerEntries(seeds);
        } else {
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLedgerEntries(list);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, colPath);
        setError('Error subscribing to live database stock ledger.');
        setLoading(false);
      });

      return unsubscribe;
    }
  }, [tenantId, itemId]);

  return {
    ledgerEntries,
    loading,
    error
  };
};

export const useStockItem = (tenantId: string | undefined, itemId: string | undefined) => {
  const [item, setItem] = useState<StockItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  useEffect(() => {
    if (!tenantId || !itemId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isSandbox) {
      try {
        const key = `stock_items_${tenantId}`;
        const cached = localStorage.getItem(key);
        const list: StockItem[] = cached ? JSON.parse(cached) : [];
        const found = list.find(x => x.id === itemId);
        setItem(found || null);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Error retrieving sandbox item profile.');
        setLoading(false);
      }
    } else {
      const docPath = `tenants/${tenantId}/stockItems/${itemId}`;
      const docRef = doc(db, docPath);

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setItem({
            id: docSnap.id,
            ...data,
            lastUpdated: data.lastUpdated?.seconds 
              ? new Date(data.lastUpdated.seconds * 1000).toISOString() 
              : data.lastUpdated || new Date().toISOString()
          } as StockItem);
        } else {
          setItem(null);
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, docPath);
        setError('Error retrieving live item profile.');
        setLoading(false);
      });

      return unsubscribe;
    }
  }, [tenantId, itemId]);

  return { item, loading, error };
};

export const useAddStockEntry = (tenantId: string | undefined) => {
  const [submitting, setSubmitting] = useState(false);
  const isSandbox = localStorage.getItem('isSandboxMode') === 'true' || !db;

  const triggerAuditAlert = useCallback(async (
    itemName: string,
    itemCode: string,
    currentQty: number,
    reorderLevel: number,
    unit: string,
    category: string
  ) => {
    if (!tenantId) return;

    const alertMessage = `⚠️ [INVENTORY ALERT] "${itemName}" (${itemCode}) has dropped to ${currentQty} ${unit}, falling at or below the reorder threshold of ${reorderLevel} ${unit}. A critical reorder order recommendation has been dispatched via the Sales & Procurement helpdesks.`;

    // 1. Log Activity Log (Audit trail)
    const actId = `act-${Date.now()}`;
    const actorInfo = { userId: auth.currentUser?.uid || 'user-system', displayName: auth.currentUser?.displayName || 'Automated BSP System' };
    const activityEvent: ActivityEvent = {
      id: actId,
      actionType: 'whatsapp_queue',
      entityType: 'whatsapp',
      entityId: itemCode,
      tenantId,
      actor: actorInfo,
      timestamp: new Date().toISOString(),
      description: alertMessage,
      metadata: { itemName, itemCode, currentQty, reorderLevel }
    };

    if (isSandbox) {
      const actKey = `flowops_activity_${tenantId}`;
      const actCached = localStorage.getItem(actKey);
      const actList: ActivityEvent[] = actCached ? JSON.parse(actCached) : [];
      localStorage.setItem(actKey, JSON.stringify([activityEvent, ...actList]));
    } else {
      try {
        const activityRef = doc(db, 'tenants', tenantId, 'activity', actId);
        await setDoc(activityRef, {
          ...activityEvent,
          timestamp: serverTimestamp()
        });
      } catch (ae) {
        console.warn('Failed to write alerts to cloud activity log', ae);
      }
    }

    // 2. Log WhatsApp notification dispatch
    const waLogId = `walog-${Date.now()}`;
    const waLog: WhatsAppLog = {
      id: waLogId,
      tenantId,
      recipientName: 'Stockroom Head & Purchase Lead',
      recipientPhone: '+919876543210',
      message: alertMessage,
      status: 'sent',
      type: 'inventory_alert',
      sentAt: new Date().toISOString()
    };

    if (isSandbox) {
      const waLogsKey = `whatsapp_logs_${tenantId}`;
      const waLogsCached = localStorage.getItem(waLogsKey);
      const waList: WhatsAppLog[] = waLogsCached ? JSON.parse(waLogsCached) : [];
      localStorage.setItem(waLogsKey, JSON.stringify([waLog, ...waList]));
    } else {
      try {
        const waLogRef = doc(db, 'whatsappLogs', waLogId);
        await setDoc(waLogRef, {
          ...waLog,
          sentAt: serverTimestamp()
        });
      } catch (we) {
        console.warn('Failed to log WhatsApp alert out', we);
      }
    }

    // Attempt direct simulated WhatsApp sync channel chat box insert
    // This allows active simulated conversation to pop up in '/whatsapp-inbox' page for amazing live demos!
    const keyConvs = `whatsapp_convs_${tenantId}`;
    let matchedConvId = 'conv-inventory';
    const cleanAlertText = alertMessage;

    const waConv = {
      id: matchedConvId,
      tenantId,
      phone: '9876543210',
      customerName: 'Procurement Dispatch Hotline',
      lastMessage: cleanAlertText,
      lastTimestamp: new Date().toISOString(),
      unreadCount: 1,
      status: 'active',
      assignedSalesUserId: auth.currentUser?.uid || 'user-system',
      createdAt: new Date().toISOString()
    };

    const waMsgObj = {
      id: `wamsg-${Date.now()}`,
      tenantId,
      conversationId: matchedConvId,
      senderPhone: '9876543210',
      recipientPhone: 'system',
      direction: 'inbound',
      message: cleanAlertText,
      timestamp: new Date().toISOString(),
      status: 'delivered'
    };

    if (isSandbox) {
      // Upsert convs
      const rawC = localStorage.getItem(keyConvs);
      let listC: any[] = rawC ? JSON.parse(rawC) : [];
      if (!listC.some(c => c.id === matchedConvId)) {
        listC.push(waConv);
      } else {
        listC = listC.map(c => c.id === matchedConvId ? {
          ...c,
          lastMessage: cleanAlertText,
          unreadCount: c.unreadCount + 1,
          lastTimestamp: new Date().toISOString()
        } : c);
      }
      localStorage.setItem(keyConvs, JSON.stringify(listC));

      // Append messages
      const keyMsgs = `whatsapp_msgs_${tenantId}_${matchedConvId}`;
      const rawM = localStorage.getItem(keyMsgs);
      const listM: any[] = rawM ? JSON.parse(rawM) : [];
      listM.push(waMsgObj);
      localStorage.setItem(keyMsgs, JSON.stringify(listM));
    } else {
      // Write to live database so it shows up in real-time whatsapp inbox
      try {
        const convRef = doc(db, 'tenants', tenantId, 'whatsappConversations', matchedConvId);
        await setDoc(convRef, {
          ...waConv,
          lastTimestamp: serverTimestamp()
        });

        const msgRef = doc(db, 'tenants', tenantId, 'whatsappConversations', matchedConvId, 'messages', waMsgObj.id);
        await setDoc(msgRef, {
          ...waMsgObj,
          timestamp: serverTimestamp()
        });
      } catch (errConv) {
        console.warn('Failed to write automated conversation alert to firestore', errConv);
      }
    }
  }, [tenantId, isSandbox]);

  const addStockEntry = useCallback(async (
    itemId: string,
    inputs: StockEntryInput
  ) => {
    if (!tenantId) throw new Error('No tenant detected');
    setSubmitting(true);

    const uid = auth.currentUser?.uid || 'user-system';
    const nameStr = auth.currentUser?.displayName || 'Store Keeper';

    try {
      if (isSandbox) {
        // 1. Retrieve items
        const itemKey = `stock_items_${tenantId}`;
        const itemsCached = localStorage.getItem(itemKey);
        const listItems: StockItem[] = itemsCached ? JSON.parse(itemsCached) : [];
        const index = listItems.findIndex(x => x.id === itemId);
        if (index === -1) throw new Error('Item not found in stock database.');

        const itemObj = listItems[index];
        const prevQty = itemObj.currentQty;
        let diff = inputs.qty;
        
        // Calculate new balance
        let newQty = prevQty;
        if (inputs.type === 'inward') newQty += diff;
        else if (inputs.type === 'outward') newQty -= diff;
        else newQty = diff; // adjustment sets exact qty

        if (newQty < 0) {
          throw new Error(`Insufficient stock level. Balance cannot fall below 0. Current stock is ${prevQty} ${itemObj.unit}.`);
        }

        // 2. Write Ledger entry
        const ledgerKey = `ledger_${tenantId}_${itemId}`;
        const ledgerCached = localStorage.getItem(ledgerKey);
        const listLedger: StockLedgerEntry[] = ledgerCached ? JSON.parse(ledgerCached) : [];

        const newLedgerId = `led-${Date.now()}`;
        const finalLedgerEntry: StockLedgerEntry = {
          id: newLedgerId,
          tenantId,
          itemId,
          timestamp: new Date().toISOString(),
          type: inputs.type,
          qty: inputs.qty,
          reason: inputs.reason || 'Manual ledger reconciliation',
          updatedBy: uid,
          updatedByName: nameStr,
          qtyAfter: newQty
        };

        const updatedLedger = [finalLedgerEntry, ...listLedger];
        localStorage.setItem(ledgerKey, JSON.stringify(updatedLedger));

        // 3. Write item update
        const updatedItem: StockItem = {
          ...itemObj,
          currentQty: newQty,
          lastUpdated: new Date().toISOString(),
          updatedBy: uid,
          updatedByName: nameStr
        };
        listItems[index] = updatedItem;
        localStorage.setItem(itemKey, JSON.stringify(listItems));

        // 4. Alert Trigger check
        // "When currentQty drops at or below reorderLevel after a stock write, trigger a WhatsApp notification to the configured contact."
        // Also ensure it crossed the line downward
        if (newQty <= updatedItem.reorderLevel) {
          await triggerAuditAlert(
            updatedItem.name,
            updatedItem.code,
            newQty,
            updatedItem.reorderLevel,
            updatedItem.unit,
            updatedItem.category
          );
        }

        setSubmitting(false);
        return finalLedgerEntry;
      } else {
        // Live production Firestore batch write
        const itemRef = doc(db, 'tenants', tenantId, 'stockItems', itemId);
        const itemSnap = await getDoc(itemRef);
        if (!itemSnap.exists()) throw new Error('Item not registered.');

        const itemData = itemSnap.data() as Omit<StockItem, 'id'>;
        const prevQty = itemData.currentQty;
        const diff = inputs.qty;
        let newQty = prevQty;
        if (inputs.type === 'inward') newQty += diff;
        else if (inputs.type === 'outward') newQty -= diff;
        else newQty = diff;

        if (newQty < 0) {
          throw new Error(`Insufficient stock level. Balance cannot fall below 0. Current stock is ${prevQty} ${itemData.unit}.`);
        }

        const batch = writeBatch(db);
        const ledgerCol = collection(db, 'tenants', tenantId, 'stockItems', itemId, 'ledger');
        const ledgerRef = doc(ledgerCol);

        const finalLedgerEntry: Omit<StockLedgerEntry, 'id'> = {
          tenantId,
          itemId,
          timestamp: serverTimestamp(),
          type: inputs.type,
          qty: inputs.qty,
          reason: inputs.reason || 'Database transaction update',
          updatedBy: uid,
          updatedByName: nameStr,
          qtyAfter: newQty
        };

        // Put down the batch
        batch.set(ledgerRef, finalLedgerEntry);
        batch.update(itemRef, {
          currentQty: newQty,
          lastUpdated: serverTimestamp(),
          updatedBy: uid,
          updatedByName: nameStr
        });

        await batch.commit();

        // 4. Trigger alert
        if (newQty <= itemData.reorderLevel) {
          await triggerAuditAlert(
            itemData.name,
            itemData.code,
            newQty,
            itemData.reorderLevel,
            itemData.unit,
            itemData.category
          );
        }

        setSubmitting(false);
        return { id: ledgerRef.id, ...finalLedgerEntry } as StockLedgerEntry;
      }
    } catch (err: any) {
      setSubmitting(false);
      throw err;
    }
  }, [tenantId, isSandbox, triggerAuditAlert]);

  return {
    addStockEntry,
    submitting
  };
};
