// src/utils/seedLoader.ts

import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  writeBatch, 
  collection 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebaseErrors';
import { 
  SEED_TENANT_ID,
  seedCustomers,
  seedRfqs,
  seedOrders,
  seedProductionJobs,
  seedDispatches,
  seedStockItems,
  seedInvoices,
  seedWhatsAppConversations,
  seedWhatsAppMessages,
  seedActivities,
  seedTenantConfig
} from '../data/seedData';

/**
 * Loads realistic demo seed data for Vulcan Gears Pvt. Ltd. (demo-tenant-001) in Firestore.
 * 
 * @param tenantId The current tenant's ID (falls back of defaults to demo-tenant-001)
 * @param onProgress Callback function for displaying progress steps to the user
 */
export async function loadDemoData(
  tenantId: string = SEED_TENANT_ID, 
  onProgress?: (step: string) => void
): Promise<void> {
  const targetTenantId = tenantId || SEED_TENANT_ID;
  const updateProgress = (msg: string) => {
    console.log(`[SeedLoader] ${msg}`);
    if (onProgress) {
      onProgress(msg);
    }
  };

  try {
    updateProgress("Verifying tenant pre-existence in database...");
    
    // Check if the tenant document already exists
    const tenantDocRef = doc(db, 'tenants', targetTenantId);
    let proceedWithOverwrites = true;
    
    try {
      const tenantSnap = await getDoc(tenantDocRef);
      if (tenantSnap.exists()) {
        updateProgress("Demo dataset found. Requesting override clearance...");
        const confirmed = window.confirm(
          `Demo data already exists for Tenant ID "${targetTenantId}".\n\n` +
          "Are you sure you want to completely overwrite and seed industrial data?"
        );
        if (!confirmed) {
          updateProgress("Data seeding operation cancelled by administrator check.");
          return;
        }
      }
    } catch (checkErr) {
      // Ignored if it doesn't exist yet or if there's an issue with checks
      console.warn("Tenant check failed, proceeding to initialize seeding.", checkErr);
    }

    updateProgress("Initializing atomic database transaction batch...");
    const batch = writeBatch(db);

    // 1. Write Tenant Settings config document
    updateProgress("Seeding Tenant parameters for Vulcan Gears Pvt. Ltd...");
    const currentTenantConfig = {
      ...seedTenantConfig,
      tenantId: targetTenantId
    };
    batch.set(doc(db, 'tenants', targetTenantId), currentTenantConfig);

    // 2. Write Customers subcollection
    updateProgress("Seeding industrial dealer and client profile listings...");
    seedCustomers.forEach(customer => {
      const custData = { ...customer, tenantId: targetTenantId };
      const custRef = doc(db, 'tenants', targetTenantId, 'customers', customer.id!);
      batch.set(custRef, custData);
    });

    // 3. Write RFQs (root collection filtered by tenantId)
    updateProgress("Seeding RFQs...");
    seedRfqs.forEach(rfq => {
      const rfqData = { ...rfq, tenantId: targetTenantId };
      const rfqRef = doc(db, 'rfqs', rfq.id);
      batch.set(rfqRef, rfqData);
    });

    // 4. Write Orders root collection
    updateProgress("Seeding Customer Orders...");
    seedOrders.forEach(order => {
      const orderData = { ...order, tenantId: targetTenantId };
      const orderRef = doc(db, 'orders', order.id);
      batch.set(orderRef, orderData);
    });

    // 5. Write Production Jobs root collection
    updateProgress("Seeding active manufacturing lines...");
    seedProductionJobs.forEach(job => {
      const jobData = { ...job, tenantId: targetTenantId };
      const jobRef = doc(db, 'productionJobs', job.id);
      batch.set(jobRef, jobData);
    });

    // 6. Write Dispatches subcollection
    updateProgress("Seeding transport fleet dispatch receipts...");
    seedDispatches.forEach(dispatch => {
      const dispatchData = { ...dispatch, tenantId: targetTenantId };
      const dispatchRef = doc(db, 'tenants', targetTenantId, 'dispatches', dispatch.id);
      batch.set(dispatchRef, dispatchData);
    });

    // 7. Write StockItems subcollection
    updateProgress("Seeding raw material and spare parts stock records...");
    seedStockItems.forEach(stockItem => {
      const stockData = { ...stockItem, tenantId: targetTenantId };
      const stockRef = doc(db, 'tenants', targetTenantId, 'stockItems', stockItem.id);
      batch.set(stockRef, stockData);
    });

    // 8. Write Invoices root collection
    updateProgress("Seeding commercial invoice billing entries...");
    seedInvoices.forEach(invoice => {
      const invoiceData = { ...invoice, tenantId: targetTenantId };
      const invoiceRef = doc(db, 'invoices', invoice.id);
      batch.set(invoiceRef, invoiceData);
    });

    // 9. Write WhatsApp Conversations & Messages
    updateProgress("Seeding WhatsApp transaction thread templates...");
    seedWhatsAppConversations.forEach(convo => {
      const convoData = { ...convo, tenantId: targetTenantId };
      const convoRef = doc(db, 'tenants', targetTenantId, 'whatsappConversations', convo.id);
      batch.set(convoRef, convoData);
    });

    seedWhatsAppMessages.forEach(msg => {
      const msgData = { ...msg, tenantId: targetTenantId };
      const msgRef = doc(
        db, 
        'tenants', 
        targetTenantId, 
        'whatsappConversations', 
        msg.conversationId, 
        'messages', 
        msg.id
      );
      batch.set(msgRef, msgData);
    });

    // 10. Write Activity Event logs (to root activityLog and subcollection for total visibility)
    updateProgress("Seeding systemic activity timeline entries...");
    seedActivities.forEach(activity => {
      const actData = { ...activity, tenantId: targetTenantId };
      
      // Root activityLog
      const rootActRef = doc(db, 'activityLog', activity.id);
      batch.set(rootActRef, actData);

      // Subcollection activity (used by index queries in some hooks)
      const subActRef = doc(db, 'tenants', targetTenantId, 'activity', activity.id);
      batch.set(subActRef, actData);
    });

    updateProgress("Committing transaction writes to Google Cloud Firestore...");
    await batch.commit();
    updateProgress("Vulcan Gears Pvt. Ltd. dataset seeded successfully! Ready for use.");

  } catch (error: any) {
    updateProgress(`ERROR: Seeding operation failed - ${error.message || error}`);
    handleFirestoreError(error, OperationType.WRITE, `tenants/${targetTenantId}/seed`);
  }
}
