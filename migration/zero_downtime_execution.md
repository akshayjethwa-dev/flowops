# Zero-Downtime Migration Execution Blueprint
**System Migration Strategy ──► Supabase Stack Transition**

This document details the systems engineering procedures required to perform a live migration of the **Ashrey FlowOps** ecosystem from Cloud Firestore to Supabase Postgres without shutting down operations, interrupting shopfloor actions, or dropping WhatsApp inbound logs.

---

## 1. Concrete 4-Stage Transition Strategy

```
[ Phase 1: Dual-Write ] ──► [ Phase 2: Historic Data Backfill ]
             │                                   │
             ▼                                   ▼
[ Phase 4: Full Cutover ] ◄── [ Phase 3: Roll-out / Feature Flags ]
```

### Phase 1: Dual-Write Activation (Write to both databases)
We boot our transition by enabling our frontend and serverless endpoints to write to both database architectures simultaneously:
*   Every insert or update (initiated via React forms or Edge Functions) is routed to **Firestore first**.
*   Upon successful response, the record is immediately parsed, transformed, and asynchronously written to **Supabase**.
*   Any write failures in the secondary Supabase system are logged in telemetry without halting the UI or blocking client actions in Firestore.

### Phase 2: Historic Data Backfill (Offline Synchronization)
While active dual-writing keeps both systems synced for fresh live datasets, we synchronize historic archives:
1.  Run the **Offline Data Migration Script** (`data_migration_script.ts`).
2.  The script uses deterministic UUID namespace mappings (`uuidv5`) which ensures that even files or records already written during Phase 1 dual-writing are upserted seamlessly without creating duplicate lines.
3.  Execute the **Storage Migration Script** to pipe heavy attachment files.

### Phase 3: Gradual Canary Switches (Feature Flagged Reading)
Rather than pulling the switch all at once, we release the Supabase read integration sequentially across modules (RFQs, Jobs status, Logistics, payments) using dynamic in-app flags:

```tsx
// Feature flags config dictionary
const FLOWOPS_FLAGS = {
  USE_SUPABASE_FOR_RFQS: true,       // Read RFQs from Supabase
  USE_SUPABASE_FOR_JOBS: false,      // KEEP reading shop floor from Firestore
  USE_SUPABASE_FOR_DISPATCH: false,
  USE_SUPABASE_FOR_PAYMENTS: false
};
```
This isolates impacts. If a bug is encountered in early views, the damage is minimized.

### Phase 4: Final Cutover (The Off Switch)
1.  Complete all testing checks, confirm schema parity, and verify that RLS isolation has zero leakage.
2.  Toggle feature flags to `true` for all modules across all screens.
3.  Retire dual-write logic in standard forms, routing writes directly to the Supabase client.
4.  Decommission the Firebase project safely.

---

## 2. Implemented Dual-Write Hook Structure

This hook can be imported across views to handle dual writes in the transition stage:

```typescript
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { collection, doc, setDoc } from 'firebase/firestore';

export async function useDualWrite() {
  const executeDualWrite = async (
    collectionName: string,
    docId: string,
    data: any,
    tenantId: string
  ) => {
    // 1. Direct Write to Primary Database (Firestore)
    const fsRef = doc(db, 'tenants', tenantId, collectionName, docId);
    await setDoc(fsRef, data);
    console.log(`[Firestore] Succesfully recorded doc ${docId}`);

    // Asynchronously and non-blockingly pipe data into Supabase
    try {
      const transformedFields = transformToPgSchema(collectionName, data, tenantId);
      const { error } = await supabase
        .from(collectionName)
        .upsert({ id: docId, ...transformedFields });

      if (error) {
        // Log telemetry warnings without interrupting the user's active session
        sendToSentry(`Supabase DualWrite error: ${error.message}`, { docId });
      } else {
        console.log(`[Supabase] In-sync upsert completed for ID: ${docId}`);
      }
    } catch (supabaseErr: any) {
      console.warn(`[Supabase DualWrite Bypass Alert]: ${supabaseErr.message}`);
    }
  };

  return { executeDualWrite };
}

// Convert Firestore schema styles to relational database rows
function transformToPgSchema(table: string, d: any, tenantId: string) {
  const tenantUuid = parseUUID(tenantId);
  switch (table) {
    case 'rfqs':
      return {
        tenant_id: tenantUuid,
        rfq_number: d.rfqNumber,
        customer_id: parseUUID(d.customerId),
        customer_name: d.customerName,
        phone: d.phone,
        requirements: d.requirements || '',
        items: d.items || [],
        status: (d.status || 'pending').toLowerCase()
      };
    case 'orders':
      return {
        tenant_id: tenantUuid,
        quote_id: d.quoteId ? parseUUID(d.quoteId) : null,
        order_number: d.orderNumber,
        customer_id: parseUUID(d.customerId),
        customer_name: d.customerName,
        phone: d.phone,
        total_amount: Math.round(d.totalAmountFloat * 100), // convert rupees to paise
        status: (d.status || 'confirmed').toLowerCase()
      };
    // Implement mappings for other modules...
    default:
      return d;
  }
}
```

---

## 3. Instant Rollback Contingency Blueprint

If a critical issue occurs (e.g. database locks, real-time sync dropouts, high request latency on PG), executing an instant safety rollback is critical.

### 3.1 Step 1: Soft Reversion
Keep the dual-write setup fully active. If reads fail on Supabase, toggle the feature flags to `false`.
```ts
// Hard revert reads to Firestore
const FLOWOPS_FLAGS = {
  USE_SUPABASE_FOR_RFQS: false,
  USE_SUPABASE_FOR_JOBS: false,
  USE_SUPABASE_FOR_DISPATCH: false,
  USE_SUPABASE_FOR_PAYMENTS: false
};
```
Because dual-writing was writing to *both* systems constantly, Firestore contains 100% of the data in structural integrity formats. Users are returned to safety instantly.

### 3.2 Step 2: Diagnosis and Rectification
1.  Check Postgres performance metrics, CPU locks, or indexes on the active Supabase dashboard.
2.  Review log alerts inside Supabase edge functions or API routers.
3.  Implement fixes on developer testing sandboxes.

### 3.3 Step 3: Re-canary Triggers
Once fixed, gradually re-enable reads via feature flags on non-critical views (e.g. `whatsapp_logs` or `activity_logs`), then expand outward again.
