# Multi-Tenancy Security Audit & RLS Validation
**Ashrey FlowOps System Engineering Blueprint**

This document establishes the official test cases, verification processes, and validation procedures to confirm the absolute cryptographic isolation of client datasets at the database layer using Supabase PostgreSQL Row Level Security (RLS).

---

## 1. Tenancy Enforcements Mechanisms (The Sandbox Guarantee)

To verify the tenant sandbox guarantees, we enforce:
1.  **Implicit Injection**: Developers do not have to append manual `.eq('tenant_id', tenantId)` constraints to select queries. If RLS is enabled, the database internally appends that filter using the claims in the JWT token.
2.  **Exempt Actions Protection**: All REST API endpoints and real-time sockets accessed via the Anon and Authenticated headers are evaluated against the current session JWT. The database blocks any attempt to edit another tenant’s rows.

---

## 2. RLS Automated Testing Script (Integration Validation)

This script uses the Supabase administrator client to register two distinct sandbox tenants, creates user accounts, updates profiles, and executes cross-tenant queries to prove that **Tenant A** can never read or write **Tenant B**'s tables.

```typescript
// ============================================================================
// MULTI-TENANCY RLS VALIDATION SCRIPT
// Language: TypeScript
// Location: /migration/security_audit_cases.ts
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-proj.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Admin client to setup mock profiles (exempt from RLS as it uses service_role)
const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function runRlsAudit() {
  console.log('>>> Standard Multi-Tenant Isolation Audit Initiated...');

  try {
    // 1. Establish Sandbox Tenant A & Tenant B
    const { data: tenantA } = await supabaseAdmin.from('tenants').insert({ company_name: 'Audit Client A' }).select().single();
    const { data: tenantB } = await supabaseAdmin.from('tenants').insert({ company_name: 'Audit Client B' }).select().single();

    if (!tenantA || !tenantB) throw new Error('Could not create standard test tenants.');

    console.log(`[+] Created Tenant A: ${tenantA.id}`);
    console.log(`[+] Created Tenant B: ${tenantB.id}`);

    // Create 2 test users in Supabase Auth
    const emailA = `engineer_a_${Date.now()}@flowops.com`;
    const emailB = `engineer_b_${Date.now()}@flowops.com`;

    const { data: authUserA } = await supabaseAdmin.auth.admin.createUser({ email: emailA, password: 'password123', email_confirm: true });
    const { data: authUserB } = await supabaseAdmin.auth.admin.createUser({ email: emailB, password: 'password123', email_confirm: true });

    if (!authUserA.user || !authUserB.user) throw new Error('Create auth users failed.');

    // 2. Link metadata in Profiles table
    await supabaseAdmin.from('profiles').insert([
      { id: authUserA.user.id, email: emailA, name: 'Engineer A', role: 'sales', tenant_id: tenantA.id },
      { id: authUserB.user.id, email: emailB, name: 'Engineer B', role: 'sales', tenant_id: tenantB.id }
    ]);

    console.log(`[+] Profiles established and linked securely.`);

    // 3. Login to get distinct client session tokens
    const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: sessionA } = await clientA.auth.signInWithPassword({ email: emailA, password: 'password123' });
    const { data: sessionB } = await clientB.auth.signInWithPassword({ email: emailB, password: 'password123' });

    console.log(`[+] Logged in users. Token sessions initialized.`);

    // 4. Create an RFQ record as Tenant A
    const { data: rfqA, error: writeErrorA } = await clientA
      .from('rfqs')
      .insert({
        rfq_number: 'RFQ-TEST-A001',
        customer_id: 'd9e76f57-e67c-47fc-b1de-111111111111', // Placeholder customer UUID
        customer_name: 'Anchor Inc.',
        phone: '+919999888877',
        status: 'pending',
        tenant_id: tenantA.id // Matches User A's tenant
      })
      .select()
      .single();

    if (writeErrorA) {
      console.error(`[-] Fail creating initial RFQ: ${writeErrorA.message}`);
    } else {
      console.log(`[+] User A created RFQ inside Tenant A: ID: ${rfqA.id}`);
    }

    // =========================================================
    // AUDIT CASE 1: Read Isolation Check
    // Attempt to read User A's RFQ from User B's client context
    // =========================================================
    console.log('\n[TEST 1] Executing Read Isolation check on User B...');
    const { data: readB, error: readError } = await clientB
      .from('rfqs')
      .select('*')
      .eq('id', rfqA.id);

    if (readError) {
      console.log(`[PASS] Read attempt blocked or errored securely: ${readError.message}`);
    } else if (!readB || readB.length === 0) {
      console.log(`[PASS] Read returned empty array. No data leaked from Tenant A to Tenant B!`);
    } else {
      console.error(`[FAIL] SECURITY COMPROMISE! User B read User A's private data! Row count: ${readB.length}`);
    }

    // =========================================================
    // AUDIT CASE 2: Write Isolation Check
    // Attempt to update Tenant A's RFQ from User B's client
    // =========================================================
    console.log('\n[TEST 2] Executing Write Isolation check on User B...');
    const { data: updateB, error: updateError } = await clientB
      .from('rfqs')
      .update({ status: 'quoted' })
      .eq('id', rfqA.id)
      .select();

    if (updateError) {
      console.log(`[PASS] Write attempt errored/rejected safely: ${updateError.message}`);
    } else if (!updateB || updateB.length === 0) {
      console.log(`[PASS] Write affected 0 rows. Modifications blocked!`);
    } else {
      console.error(`[FAIL] SECURITY COMPROMISE! User B successfully modified Tenant A's RFQ!`);
    }

    // =========================================================
    // AUDIT CASE 3: Tenant Spoofing Bypass Check
    // Attempt to write a record to Tenant B's tables but passing Tenant A's ID
    // =========================================================
    console.log('\n[TEST 3] Executing spoofing bypass checks (User A forces entry to B)...');
    const { data: spoofInsert, error: spoofError } = await clientA
      .from('rfqs')
      .insert({
        rfq_number: 'RFQ-SPOOF-001',
        customer_id: 'd9e76f57-e67c-47fc-b1de-111111111111',
        customer_name: 'Spoof Corp',
        phone: '+919999888877',
        status: 'pending',
        tenant_id: tenantB.id // SPOOFING: Target Tenant B ID!
      })
      .select();

    if (spoofError) {
      console.log(`[PASS] Spoof injection rejected by server RLS: ${spoofError.message}`);
    } else if (!spoofInsert || spoofInsert.length === 0) {
      console.log(`[PASS] Spoof write returned zeros rows. Action safely discarded.`);
    } else {
      console.error(`[FAIL] SECURITY RISK! User A injection of a row registered directly to Tenant B allowed!`);
    }

    // Clean up test tables programmatically
    console.log('\nCleaning test workspaces...');
    await supabaseAdmin.from('tenants').delete().in('id', [tenantA.id, tenantB.id]);
    await supabaseAdmin.auth.admin.deleteUser(authUserA.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authUserB.user.id);
    console.log('Cleanup completed. Audit finished.');

  } catch (err: any) {
    console.error(`Exception during active audit runtime: ${err.message}`);
  }
}
```

---

## 3. Explaining SQL-Level RLS Bypass Protections

Even if an attacker attempts to call our REST endpoint directly bypass client libraries, PostgreSQL prevents data leaks because:
*   The `USING` expression in RLS policies operates directly on the JWT parsed during session initiation.
*   The system uses the `tenant_id` claim **from the JWT** (via `auth.get_tenant_id()`) rather than taking input parameters passed in the payload.
*   The `WITH CHECK` expression on inserts ensures that the user cannot set `tenant_id` to any parameter other than their *own* parsed JWT client tenant ID. Creating records targeting another company's UUID fails constraint validations immediately.
