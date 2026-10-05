# Supabase Environment Setup & CLI Deployment Checklist
**SaaS Platform Deployment Blueprint**

This checklist details the steps to launch, configure, and maintain your Supabase production environments, including local deployments, migration version control, and Vercel hosting rules.

---

## 1. Supabase Project Initial Setup

1.  **Create Supabase Account**: Sign up at [supabase.com](https://supabase.com).
2.  **Create New Project**:
    *   **Project Name**: `Ashrey FlowOps Production`
    *   **Database Password**: Generate a secure password and store it.
    *   **Region**: Select a regional cloud data center close to your operations (e.g., `ap-south-1` Mumbai, India, to minimize latency).
    *   **Tier**: Pro Tier (Standard for Multi-tenant database RLS performance & scaling).

---

## 2. Supabase CLI Local Environment Setup & DB Versioning

Supabase uses database migrations corresponding to rails/django versioning. 

1.  **Install Supabase CLI**:
    ```bash
    npm install supabase --save-dev
    ```
2.  **Initialize local configuration**:
    ```bash
    npx supabase init
    ```
    This creates a `/supabase` config directory containing structure, config parameters, and migration folders.
3.  **Link Database Local to Cloud Project**:
    ```bash
    npx supabase link --project-ref your-supabase-project-id
    ```
4.  **Create Initial Schema Migration script file**:
    ```bash
    npx supabase migration new initial_tenant_schema
    ```
    This builds a target migration schema file inside `/supabase/migrations/<timestamp>_initial_tenant_schema.sql`.
5.  **Inject the SQL Schema**:
    Copy the full contents of `/migration/tenant_schema.sql` into that newly created timestamp file.
6.  **Apply Migration to Cloud Database**:
    ```bash
    npx supabase db push
    ```

---

## 3. Storage Buckets and API Webhook Triggers Configuration

Once the database is live:
1.  Navigate to the Supabase Studio dashboard -> **Storage** panel.
2.  Create a bucket named `drawings-and-attachments`. Ensure it is set to **Private**.
3.  Execute the custom Storage RLS Policies SQL inside the SQL Editor panel (found under `/migration/storage_migration_script.ts`).
4.  Navigate to **Database** -> **Webhooks** and create a new webhook named `whatsapp_dispatch_webhook`:
    *   **Trigger Table**: `jobs`
    *   **Trigger Events**: `UPDATE`
    *   **Webhook Target URL**: `https://<edge-function-route>.supabase.co/functions/v1/whatsapp_outbound`

---

## 4. Required Environment Variables Config Checklist

Add these variables to your Vercel deployment variables panel:

### 4.1 Client-Side Configurations (Safe in Browser - prefixed with VITE_)
```env
# Supabase Core Public Credentials
VITE_SUPABASE_URL=https://your-supabase-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJi...
```

### 4.2 Server-Side Settings / Edge Functions Configuration (Hidden from browser)
```env
# System Level Administrative Keys (Exempt from RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUz... # DO NOT exposing this to client

# WhatsApp Gateway Credentials
AISENSY_API_KEY=aisensy_prod_auth_key_111
INTERAKT_API_KEY=interakt_prod_auth_key_222

# Email & Sync Integrations
RESEND_API_KEY=re_abc123...
TALLY_SYNC_TOKEN=tally_secure_bearer_token_xyz
```

---

## 5. Vercel Frontend Deployment Configurations

Add a `vercel.json` file to the root of your Next.js project to configure routing rules, secure headers, and route redirects correctly:

```json
{
  "version": 2,
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self' https://*.supabase.co; img-src 'self' data: https://*.supabase.co; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
        }
      ]
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```
This is fully configured and ready for production staging on Vercel.
