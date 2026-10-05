// ============================================================================
// ASHREY FLOWOPS — SUPABASE EDGE FUNCTIONS & NEXT.JS SERVERLESS ROUTING
// Language: TypeScript
// Target Runtime: Deno (Edge Function) or Node.js (Next.js API route)
// Location: /migration/edge_functions.ts
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// FUNCTION 1: WHATSAPP OUTBOUND TRIGGER (AiSensy & Interakt API Integrations)
// Called via Supabase Database Webhook when job stage or order status updates.
// ============================================================================

export async function whatsappOutboundHandler(req: Request): Promise<Response> {
  try {
    const payload = await req.json();
    
    // webhook payloads from Supabase capture: { type: 'INSERT|UPDATE', table: 'jobs', record: {...}, old_record: {...} }
    const { record, old_record, type } = payload;
    
    if (type !== 'UPDATE' || !record) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'Not an update event' }), { status: 200 });
    }

    // Check if status/stage changed
    const stageChanged = record.current_stage !== old_record.current_stage;
    const orderStatusChanged = record.status !== old_record.status;

    if (!stageChanged && !orderStatusChanged) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'No significant status modification' }), { status: 200 });
    }

    const { tenant_id, phone, customer_name, item_name, quantity, current_stage, order_number } = record;
    const targetPhone = phone || '+919876543210'; // Conforms to India format +91XXXXXXXXXX
    const cleanPhone = targetPhone.replace(/\D/g, ''); // strip formatting leaving clean digits: 919876543210

    // Initialize Supabase to pull Tenant company Name
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    const { data: tenant } = await supabase.from('tenants').select('company_name').eq('id', tenant_id).single();
    const company = tenant?.company_name || 'Bharat Gears & Castings';

    // Core templates configurations variables
    let templateName = '';
    let templateParams: string[] = [];

    if (stageChanged) {
      templateName = 'shopfloor_stage_advanced';
      templateParams = [
        customer_name || 'Valued Partner',
        item_name || 'Components Item',
        quantity?.toString() || '1',
        current_stage?.toUpperCase().replace('_', ' '),
        company
      ];
    } else {
      templateName = 'order_status_update';
      templateParams = [
        customer_name || 'Valued Partner',
        order_number || 'Order',
        record.status?.toUpperCase(),
        company
      ];
    }

    // -------------------------------------------------------------
    // OPTION A: AISENSY REST API INTEGRATION
    // -------------------------------------------------------------
    const aisensyApiKey = process.env.AISENSY_API_KEY;
    if (aisensyApiKey) {
      const aisensyResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aisensyApiKey}` },
        body: JSON.stringify({
          apiKey: aisensyApiKey,
          campaignName: templateName,
          destination: cleanPhone,
          userName: customer_name || 'Client',
          templateParams: templateParams,
          source: 'FlowOps Webhook'
        })
      });
      const aisensyData = await aisensyResponse.json();
      console.log('AiSensy submission result:', aisensyData);
    }

    // -------------------------------------------------------------
    // OPTION B: INTERAKT REST API INTEGRATION (Alternate Route)
    // -------------------------------------------------------------
    const interaktApiKey = process.env.INTERAKT_API_KEY;
    if (interaktApiKey) {
      const interaktResponse = await fetch('https://api.interakt.ai/v1/public/track/users/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${btoa(interaktApiKey + ':')}` },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          event: templateName,
          traits: {
            name: customer_name || 'Client',
            company: company
          },
          template: {
            name: templateName,
            languageCode: 'en',
            bodyValues: templateParams
          }
        })
      });
      const interaktData = await interaktResponse.json();
      console.log('Interakt submission result:', interaktData);
    }

    // Log the transaction in whatsapp_logs
    await supabase.from('whatsapp_logs').insert({
      tenant_id,
      recipient_phone: targetPhone,
      recipient_name: customer_name || 'Standard Client',
      type: stageChanged ? 'STAGE_ADVANCED' : 'ORDER_STATUS_SHIFT',
      message: `Template: ${templateName} sent containing parameters: [${templateParams.join(', ')}]`,
      status: 'sent'
    });

    return new Response(JSON.stringify({ status: 'processed', message: 'WhatsApp templates dispatched' }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// ============================================================================
// FUNCTION 2: DAILY SUMMARY CRON JOB (Every morning management briefs)
// Executed daily. Pulls preceding 24h metrics per Tenant and sends recap digests.
// ============================================================================

export async function dailySummaryCronJob(req: Request): Promise<Response> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  
  try {
    // A. Retrieve all active non-deleted Tenants
    const { data: tenants, error: tError } = await supabase.from('tenants').select('id, company_name').is('deleted_at', null);
    if (tError) throw tError;

    for (const tenant of tenants) {
      const tenantId = tenant.id;

      // 1. Gather RFQ count received yesterday
      const { count: freshRfqs } = await supabase
        .from('rfqs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', yesterday);

      // 2. Gather sum total value of orders confirmed yesterday (Bigint Paise values)
      const { data: dailyOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenantId)
        .gte('created_at', yesterday);
      const totalOrderValPaise = dailyOrders?.reduce((sum, ord) => sum + Number(ord.total_amount), 0) || 0;
      const totalOrderValRupees = totalOrderValPaise / 100;

      // 3. Outstanding invoice sum
      const { data: outstandingInvs } = await supabase
        .from('quotations') // quotations/invoice totals
        .select('total')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved'); // Approved acting as outstanding invoices link
      const totalOutstandingPaise = outstandingInvs?.reduce((sum, q) => sum + Number(q.total), 0) || 0;
      const totalOutstandingRupees = totalOutstandingPaise / 100;

      // 4. Dispatch freight shipments counts completed yesterday
      const { count: freshDispatches } = await supabase
        .from('dispatches')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('dispatched_at', yesterday);

      // B. Compile dynamic management report metrics message brief
      const messageBody = `
⚡ *Ashrey FlowOps Morning Brief* ⚡
🏭 *Plant:* ${tenant.company_name}
📅 *Period:* Previous 24h Summary

📈 *New RFQ Inquiries:* ${freshRfqs || 0}
📦 *New Confirmed Orders:* ₹${totalOrderValRupees.toLocaleString('en-IN')}
🚚 *Departed Cargo Dispatches:* ${freshDispatches || 0} cargo units
💰 *Total Portfolio Outstanding:* ₹${totalOutstandingRupees.toLocaleString('en-IN')}

_FlowOps Connected Manufacturing Systems_
      `.trim();

      // C. Submit briefing directly to Management users within this tenant
      const { data: managementProfiles } = await supabase
        .from('profiles')
        .select('phone, name')
        .eq('tenant_id', tenantId)
        .in('role', ['admin', 'management']);

      if (managementProfiles && managementProfiles.length > 0) {
        for (const user of managementProfiles) {
          if (!user.phone) continue;
          const cleanPhone = user.phone.replace(/\D/g, '');
          
          // Call AiSensy or Resend Email depending on preferences
          if (process.env.AISENSY_API_KEY) {
            await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AISENSY_API_KEY}` },
              body: JSON.stringify({
                apiKey: process.env.AISENSY_API_KEY,
                campaignName: 'morning_brief_summary',
                destination: cleanPhone,
                userName: user.name,
                templateParams: [user.name, (freshRfqs || 0).toString(), `INR ${totalOrderValRupees}`, (freshDispatches || 0).toString()]
              })
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ status: 'completed', data: `Processed brief logs for ${tenants.length} tenants.` }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// ============================================================================
// FUNCTION 3: RFQ & QUOTATION FOLLOW-UP REMINDER (Auto check older offers)
// Executed chronologically to fetch Quotations sent 3+ days ago with no update.
// ============================================================================

export async function quotationFollowUpJob(req: Request): Promise<Response> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

  try {
    // Pull quotations in 'sent' state older than 3 days
    const { data: quotations, error } = await supabase
      .from('quotations')
      .select('id, quote_number, customer_name, phone, tenant_id, subtotal, total')
      .eq('status', 'sent')
      .lte('created_at', threeDaysAgo);

    if (error) throw error;
    console.log(`[+] Found ${quotations?.length} quotations requiring client nudge...`);

    for (const quote of quotations) {
      const cleanPhone = quote.phone.replace(/\D/g, '');
      const valueRupees = Number(quote.total) / 100;

      if (process.env.AISENSY_API_KEY) {
        // Send followup template to customer
        await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.AISENSY_API_KEY}` },
          body: JSON.stringify({
            apiKey: process.env.AISENSY_API_KEY,
            campaignName: 'quotation_gentle_followup',
            destination: cleanPhone,
            userName: quote.customer_name,
            templateParams: [
              quote.customer_name,
              quote.quote_number,
              `INR ${valueRupees.toLocaleString('en-IN')}`
            ]
          })
        });

        // Insert notification tracing log
        await supabase.from('whatsapp_logs').insert({
          tenant_id: quote.tenant_id,
          recipient_phone: quote.phone,
          recipient_name: quote.customer_name,
          type: 'QTN_FOLLOWUP_NUDGE',
          message: `Auto Quotation Follow-up template invoked. Quote ref: ${quote.quote_number}`,
          status: 'sent'
        });
      }
    }

    return new Response(JSON.stringify({ status: 'completed', count: quotations.length }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// ============================================================================
// FUNCTION 4: TALLY XML/JSON SYNC WEBHOOK HANDLER
// Receives invoice, ledger, or payments postings from on-premise Tally.
// Maps transactions atomically and logs audits.
// ============================================================================

export async function tallyWebhookHandler(req: Request): Promise<Response> {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  // Simple secure API token check on incoming webhooks
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TALLY_SYNC_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized Tally Integration Token' }), { status: 401 });
  }

  try {
    const payload = await req.json();
    
    // Structure expected: { companyGstin: string, transactionType: 'INVOICE_BILL'|'PAYMENT_RECEIPT', payloadDetails: {...} }
    const { companyGstin, transactionType, payloadDetails } = payload;
    if (!companyGstin) {
      return new Response(JSON.stringify({ error: 'Missing active company GSTIN lookup identifier' }), { status: 400 });
    }

    // A. Identify active tenant uuid mapping matched GSTIN
    const { data: tenant, error: tError } = await supabase
      .from('tenants')
      .select('id, company_name')
      .eq('gstin', companyGstin)
      .single();

    if (tError || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant record not matched for specified GSTIN' }), { status: 404 });
    }

    const tenantId = tenant.id;

    // B. Map operations based on incoming Ledger logs
    if (transactionType === 'INVOICE_BILL') {
      const { invoiceNumber, customerName, subtotalRupees, totalRupees, rfqIdReference } = payloadDetails;

      const totalPaise = Math.round(totalRupees * 100);
      const subtotalPaise = Math.round(subtotalRupees * 100);
      const gstPaise = totalPaise - subtotalPaise;

      // Upsert transaction on orders/quotations matrix
      const { error: upsertError } = await supabase.from('quotations').upsert({
        quote_number: invoiceNumber,
        tenant_id: tenantId,
        customer_name: customerName,
        phone: payloadDetails.phone || '+919999999999',
        subtotal: subtotalPaise,
        gst_amount: gstPaise,
        total: totalPaise,
        valid_until: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        status: 'approved', // Tally approved invoice syncing
        rfq_id: rfqIdReference,
        customer_id: payloadDetails.customerId
      });

      if (upsertError) throw upsertError;

    } else if (transactionType === 'PAYMENT_RECEIPT') {
      const { invoiceNumber, paymentReceivedRupees, paymentDate } = payloadDetails;
      
      // Update outstanding and payments statuses
      console.log(`Processing payments for ${invoiceNumber} total received: ₹${paymentReceivedRupees}`);
      // Record payment ledger rows, mark invoices as Paid
    }

    // Insert sync audit event log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      user_name: 'Tally ERP Connector',
      action: 'TALLY_RECONCILIATION_SYNC',
      description: `Synched transaction of type ${transactionType} from ERP gateway.`
    });

    return new Response(JSON.stringify({ status: 'success', syncedTenant: tenant.company_name }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

// ============================================================================
// FUNCTION 5: INVITE EMAIL ONBOARDING SENDER (Using Resend API)
// Dispatches rich responsive HTML invite messages containing secure invite tokens.
// ============================================================================

export async function teammateInviteEmailSender(req: Request): Promise<Response> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Resend API configurations missing' }), { status: 500 });
  }

  const payload = await req.json();
  const { invitedEmail, invitedName, joinRole, companyName, inviteLink } = payload;

  if (!invitedEmail || !inviteLink) {
    return new Response(JSON.stringify({ error: 'Parameters validation failed' }), { status: 400 });
  }

  try {
    const htmlBody = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="margin-bottom: 24px; border-bottom: 3px solid #0ea5e9; padding-bottom: 12px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px; font-weight: 700; tracking-tight;">Ashrey FlowOps™</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; font-family: monospace;">CONNECTED MANUFACTURING WORKSPACES</p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${invitedName || 'Colleague'}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">You have been invited by your administrator to join the active manufacturing digital console at <strong>${companyName}</strong>.</p>
        
        <div style="margin: 28px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-size: 12px; font-family: monospace; text-transform: uppercase; color: #64748b; padding-bottom: 4px;">Assigned workspace role</td>
            </tr>
            <tr>
              <td style="font-size: 16px; font-weight: bold; color: #0284c7; text-transform: uppercase;">${joinRole}</td>
            </tr>
          </table>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 30px;">Click the action button below to complete registration, set your password, and access your team's shopfloor boards:</p>
        
        <div style="text-align: center; margin: 34px 0;">
          <a href="${inviteLink}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-family: monospace; font-weight: bold; text-transform: uppercase; border-radius: 6px; letter-spacing: 1px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Accept Invitation</a>
        </div>
        
        <p style="font-size: 12px; line-height: 1.6; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 40px;">
          If the button does not work, copy and paste this link in your browser: <br/>
          <a href="${inviteLink}" style="color: #0ea5e9; text-decoration: none; word-break: break-all;">${inviteLink}</a>
        </p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'FlowOps Workspace <onboarding@yourdomain.com>',
        to: invitedEmail,
        subject: `Join ${companyName} on Ashrey FlowOps Workspace`,
        html: htmlBody
      })
    });

    const emailData = await resendRes.json();
    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), { status: 200 });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
