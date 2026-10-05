// ============================================================================
// FIRESTORE TO POSTGRESQL DATA MIGRATION ENGINE
// Language: TypeScript
// Dependencies: firebase-admin, @supabase/supabase-js
// Location: /migration/data_migration_script.ts
// ============================================================================

import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// 1. ENVIRONMENT CONFIGURATION & INITIALIZATION
// ----------------------------------------------------------------------------

// Standard fallback environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'flowops-production';

// Initialize Firebase Admin using Application Default Credentials (ADC) or credentials key
if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: FIREBASE_PROJECT_ID
  });
}

const db = admin.firestore();

// Initialize Supabase admin client using Service Role bypasses (RLS-exempt for migrations)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Helper for converting Firestore timestamp safely
function parseTimestamp(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  return new Date(timestamp).toISOString();
}

// Convert rupees values to Paise integer safely to completely avoid floating point error
function toPaise(rupees: number | null | undefined): number {
  if (rupees === null || rupees === undefined) return 0;
  return Math.round(rupees * 100);
}

// Ensure UUID conformance. Generates valid UUID v4 deterministically from Firestore string IDs for idempotency
import { v5 as uuidv5 } from 'uuid';
const DETERMINISTIC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID standard Namespace URL
function toUUID(firestoreId: string): string {
  // If already a valid UUID format, return as is
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId);
  if (isUuid) return firestoreId;
  return uuidv5(firestoreId, DETERMINISTIC_NAMESPACE);
}

console.log(`Starting Data Migration Engine at ${new Date().toISOString()}`);

// ----------------------------------------------------------------------------
// 2. MIGRATION MODULES
// ----------------------------------------------------------------------------

export async function migrateAllData() {
  try {
    // ---------------------------------------------------------
    // Phase A: Tenants Metadata Migration
    // ---------------------------------------------------------
    console.log('\n>>> Starting Phase A: Tenants Migration...');
    const tenantsSnap = await db.collection('tenants').get();
    const tenantIds: string[] = [];

    for (const doc of tenantsSnap.docs) {
      const d = doc.data();
      const tenantUuid = toUUID(doc.id);
      tenantIds.push(doc.id);

      const mappedTenant = {
        id: tenantUuid,
        company_name: d.companyName || 'Unknown SME Co.',
        gstin: d.gstin || null,
        sandbox_mode: !!d.sandboxMode,
        stage_configuration: JSON.stringify(d.stageConfiguration || []),
        created_at: parseTimestamp(d.createdAt)
      };

      const { error } = await supabase.from('tenants').upsert(mappedTenant);
      if (error) {
        console.error(`[-] Fail to upsert Tenant ${doc.id}: ${error.message}`);
      } else {
        console.log(`[+] Migrated Tenant ${doc.id} -> UUID ${tenantUuid}`);
      }
    }

    // ---------------------------------------------------------
    // Phase B: Users Profiles Migration
    // ---------------------------------------------------------
    console.log('\n>>> Starting Phase B: Users Profiles Migration...');
    const usersSnap = await db.collection('users').get();
    for (const doc of usersSnap.docs) {
      const d = doc.data();
      const userUuid = toUUID(doc.id);
      const tenantUuid = toUUID(d.tenantId);

      const mappedProfile = {
        id: userUuid,
        email: d.email,
        name: d.name || 'Anonymous Worker',
        role: (d.role || 'sales').toLowerCase(),
        tenant_id: tenantUuid,
        created_at: parseTimestamp(d.createdAt),
        last_active: d.lastActive ? parseTimestamp(d.lastActive) : null
      };

      const { error } = await supabase.from('profiles').upsert(mappedProfile);
      if (error) {
        console.error(`[-] Fail to upsert profile for ${doc.id}: ${error.message}`);
      } else {
        console.log(`[+] Migrated Profile ${d.email}`);
      }
    }

    // ---------------------------------------------------------
    // Phase C: Subcollections Migration (Iterate per sandbox tenant)
    // ---------------------------------------------------------
    for (const rawTenantId of tenantIds) {
      const tenantUuid = toUUID(rawTenantId);
      console.log(`\n======================================================`);
      console.log(`MIGRATING SUB-RECORDS FOR TENANT: ${rawTenantId}`);
      console.log(`======================================================`);

      // 1. Customers Module
      console.log(`\n- Migrating Customers for ${rawTenantId}...`);
      const customersSnap = await db.collection('tenants').doc(rawTenantId).collection('customers').get();
      for (const doc of customersSnap.docs) {
        const d = doc.data();
        const mappedCust = {
          id: toUUID(doc.id),
          tenant_id: tenantUuid,
          company_name: d.companyName,
          contact_person: d.contactPerson || 'Purchases Desk',
          phone: d.phone ? d.phone.toString() : '+919999999999',
          email: d.email || null,
          gstin: d.gstin || null,
          billing_address: d.billingAddress || {},
          dealer_tier: (d.dealerTier || 'standard').toLowerCase(),
          created_at: parseTimestamp(d.createdAt)
        };

        const { error } = await supabase.from('customers').upsert(mappedCust);
        if (error) console.error(`  [-] Customer upload failed for ${doc.id}: ${error.message}`);
      }

      // 2. RFQs Tracker
      console.log(`- Migrating RFQs for ${rawTenantId}...`);
      const rfqsSnap = await db.collection('tenants').doc(rawTenantId).collection('rfqs').get();
      for (const doc of rfqsSnap.docs) {
        const d = doc.data();
        let statusNormalized = (d.status || 'pending').toLowerCase();
        if (statusNormalized === 'quoted') statusNormalized = 'quoted';
        if (statusNormalized === 'declined') statusNormalized = 'declined';

        const mappedRfq = {
          id: toUUID(doc.id),
          rfq_number: d.rfqNumber || `RFQ-MIG-${Date.now()}`,
          tenant_id: tenantUuid,
          customer_id: toUUID(d.customerId),
          customer_name: d.customerName || 'Anonymous Customer',
          phone: d.phone || '+919999999999',
          requirements: d.requirements || '',
          items: d.items || [],
          status: statusNormalized,
          created_at: parseTimestamp(d.createdAt)
        };

        const { error } = await supabase.from('rfqs').upsert(mappedRfq);
        if (error) console.error(`  [-] RFQ upload failed for ${doc.id}: ${error.message}`);
      }

      // 3. Quotations Calculations
      console.log(`- Migrating Quotations for ${rawTenantId}...`);
      const quotationsSnap = await db.collection('tenants').doc(rawTenantId).collection('quotations').get();
      for (const doc of quotationsSnap.docs) {
        const d = doc.data();
        const mappedQuote = {
          id: toUUID(doc.id),
          rfq_id: toUUID(d.rfqId),
          quote_number: d.quoteNumber || `QTN-MIG-${Date.now()}`,
          tenant_id: tenantUuid,
          customer_id: toUUID(d.customerId),
          customer_name: d.customerName || 'Customer Co.',
          phone: d.phone || '+919999999999',
          items: d.items || [],
          subtotal: toPaise(d.subtotal),
          gst_amount: toPaise(d.gstAmount),
          total: toPaise(d.total),
          valid_until: parseTimestamp(d.validUntil),
          status: (d.status || 'draft').toLowerCase(),
          created_at: parseTimestamp(d.createdAt)
        };

        const { error } = await supabase.from('quotations').upsert(mappedQuote);
        if (error) console.error(`  [-] Quotation upload failed for ${doc.id}: ${error.message}`);
      }

      // 4. B2B Orders Matrix
      console.log(`- Migrating Orders for ${rawTenantId}...`);
      const ordersSnap = await db.collection('tenants').doc(rawTenantId).collection('orders').get();
      for (const doc of ordersSnap.docs) {
        const d = doc.data();
        const mappedOrder = {
          id: toUUID(doc.id),
          quote_id: d.quoteId ? toUUID(d.quoteId) : null,
          order_number: d.orderNumber || `ORD-MIG-${Date.now()}`,
          tenant_id: tenantUuid,
          customer_id: toUUID(d.customerId),
          customer_name: d.customerName || 'Vendor Co.',
          phone: d.phone || '+919999999999',
          total_amount: toPaise(d.totalAmount),
          status: (d.status || 'confirmed').toLowerCase(),
          created_at: parseTimestamp(d.createdAt)
        };

        const { error } = await supabase.from('orders').upsert(mappedOrder);
        if (error) console.error(`  [-] Order upload failed for ${doc.id}: ${error.message}`);
      }

      // 5. Shopfloor WIP Jobs
      console.log(`- Migrating Shopfloor Jobs for ${rawTenantId}...`);
      const jobsSnap = await db.collection('tenants').doc(rawTenantId).collection('jobs').get();
      for (const doc of jobsSnap.docs) {
        const d = doc.data();
        const mappedJob = {
          id: toUUID(doc.id),
          order_id: toUUID(d.orderId),
          tenant_id: tenantUuid,
          item_name: d.itemName || 'Industrial Casting Components',
          quantity: d.quantity || 1,
          current_stage: d.currentStage || 'pattern_shop',
          stages_history: d.stagesHistory || [],
          created_at: parseTimestamp(d.createdAt || d.updatedAt),
          updated_at: parseTimestamp(d.updatedAt)
        };

        const { error } = await supabase.from('jobs').upsert(mappedJob);
        if (error) console.error(`  [-] Job upload failed for ${doc.id}: ${error.message}`);
      }

      // 6. Logistics Dispatches
      console.log(`- Migrating Dispatches for ${rawTenantId}...`);
      const dispatchesSnap = await db.collection('tenants').doc(rawTenantId).collection('dispatches').get();
      for (const doc of dispatchesSnap.docs) {
        const d = doc.data();
        const mappedDisp = {
          id: toUUID(doc.id),
          order_id: toUUID(d.orderId),
          invoice_number: d.invoiceNumber || 'MIG-INV-UNKNOWN',
          tenant_id: tenantUuid,
          transporter: d.transporter || 'Self Carrier',
          lr_number: d.lrNumber || d.LRNumber || 'MIG-LR-DUMMY',
          vehicle_number: d.vehicleNumber || 'GJ-01-DUMMY',
          driver_name: d.driverName || 'Shivraj',
          driver_phone: d.driverPhone || '+919999999999',
          status: (d.status || 'shipped').toLowerCase(),
          items: d.items || [],
          dispatched_at: parseTimestamp(d.dispatchedAt),
          delivered_at: d.deliveredAt ? parseTimestamp(d.deliveredAt) : null
        };

        const { error } = await supabase.from('dispatches').upsert(mappedDisp);
        if (error) console.error(`  [-] Dispatch upload failed for ${doc.id}: ${error.message}`);
      }

      // 7. Webhook & WhatsApp Communication Logs
      console.log(`- Migrating WhatsApp Logs for ${rawTenantId}...`);
      const whatsappLogsSnap = await db.collection('tenants').doc(rawTenantId).collection('whatsapp_logs').get();
      for (const doc of whatsappLogsSnap.docs) {
        const d = doc.data();
        const mappedWlog = {
          id: toUUID(doc.id),
          tenant_id: tenantUuid,
          recipient_phone: d.recipientPhone || '+919999999999',
          recipient_name: d.recipientName || 'Client Name',
          type: d.type || 'NOTIFICATION',
          message: d.message || '',
          bsp_message_id: d.bspMessageId || null,
          status: (d.status || 'sent').toLowerCase(),
          timestamp: parseTimestamp(d.timestamp)
        };

        const { error } = await supabase.from('whatsapp_logs').upsert(mappedWlog);
        if (error) console.error(`  [-] WhatsApp Log upload failed for ${doc.id}: ${error.message}`);
      }

      // 8. Platform Audit Footprints
      console.log(`- Migrating Audit & Event Logs for ${rawTenantId}...`);
      const auditLogsSnap = await db.collection('tenants').doc(rawTenantId).collection('activity_logs').get();
      for (const doc of auditLogsSnap.docs) {
        const d = doc.data();
        const mappedAlog = {
          id: toUUID(doc.id),
          tenant_id: tenantUuid,
          user_id: d.userId ? toUUID(d.userId) : null,
          user_name: d.userName || 'System Engine',
          action: d.action || 'MODIFY',
          description: d.description || '',
          timestamp: parseTimestamp(d.timestamp)
        };

        const { error } = await supabase.from('audit_logs').upsert(mappedAlog);
        if (error) console.error(`  [-] Audit Log upload failed for ${doc.id}: ${error.message}`);
      }
    }

    console.log('\n======================================================');
    console.log('MIGRATION ENGINE EXECUTED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (error: any) {
    console.error(`[-] SYSTEM ENGINE MIGRATION FATAL EXCEPTION: ${error.message}`);
    process.exit(1);
  }
}

// Command-line self-triggering logic during stand-alone executions
if (require.main === module) {
  migrateAllData().then(() => {
    console.log('Engine completed clean exit.');
    process.exit(0);
  });
}
