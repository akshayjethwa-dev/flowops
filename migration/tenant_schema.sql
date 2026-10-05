-- ============================================================================
-- SQL SCHEMA FOR ASHREY FLOWOPS (SUPABASE PG WITH RLS)
-- Target Stack: PostgreSQL 15+ with Row Level Security (RLS)
-- Location: /migration/tenant_schema.sql
-- ============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. ENUM DEFINITIONS (TYPINGS)
-- ==========================================

create type user_role as enum ('admin', 'sales', 'production', 'dispatch', 'management');
create type dealer_tier as enum ('standard', 'silver', 'gold');
create type rfq_status as enum ('pending', 'quoted', 'declined');
create type quotation_status as enum ('draft', 'sent', 'approved', 'declined');
create type order_status as enum ('confirmed', 'dispatched', 'completed');
create type dispatch_status as enum ('shipped', 'delivered');
create type whatsapp_log_status as enum ('pending', 'sent', 'delivered', 'failed');

-- ==========================================
-- 2. CORE TABLE SCHEMAS
-- ==========================================

-- A. Tenants (Core sandbox directory)
create table tenants (
    id uuid primary key default gen_random_uuid(),
    company_name varchar(255) not null,
    gstin varchar(15) check (length(gstin) = 15 or gstin is null),
    sandbox_mode boolean default false not null,
    stage_configuration jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz -- Soft delete Support
);

-- B. Profiles (SaaS Team accounts linked to Supabase Auth UUIDs)
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email varchar(255) not null unique,
    name varchar(255) not null,
    role user_role not null default 'sales'::user_role,
    tenant_id uuid not null references tenants(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    last_active timestamptz,
    deleted_at timestamptz
);

-- C. Customers (Dealer directories)
create table customers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    company_name varchar(255) not null,
    contact_person varchar(255) not null,
    phone varchar(15) not null check (phone ~ '^\+?[1-9]\d{1,14}$'), -- E.164 phone conformance
    email varchar(255) check (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    gstin varchar(15) check (length(gstin) = 15 or gstin is null),
    billing_address jsonb not null default '{}'::jsonb, -- { street, city, state, zip }
    dealer_tier dealer_tier not null default 'standard'::dealer_tier,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz
);

-- D. RFQs (Inquiries tracking)
create table rfqs (
    id uuid primary key default gen_random_uuid(),
    rfq_number varchar(50) not null,
    tenant_id uuid not null references tenants(id) on delete cascade,
    customer_id uuid not null references customers(id) on delete restrict,
    customer_name varchar(255) not null, -- Cached de-normalized copy for report performance
    phone varchar(15) not null,
    requirements text,
    items jsonb not null default '[]'::jsonb, -- Array list: [{ name: string, quantity: number }]
    status rfq_status not null default 'pending'::rfq_status,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz
);

-- E. Quotations (B2B Price Offers - Values stored in Paise (Int))
create table quotations (
    id uuid primary key default gen_random_uuid(),
    rfq_id uuid not null references rfqs(id) on delete restrict,
    quote_number varchar(50) not null,
    tenant_id uuid not null references tenants(id) on delete cascade,
    customer_id uuid not null references customers(id) on delete restrict,
    customer_name varchar(255) not null,
    phone varchar(15) not null,
    items jsonb not null default '[]'::jsonb, -- Array list: [{ name: string, quantity: number, unitPrice: integer, total: integer }]
    subtotal bigint not null default 0, -- Stored in paise to eliminate float rounding errors
    gst_amount bigint not null default 0, -- 18% Standard GST
    total bigint not null default 0, -- subtotal + gst_amount
    valid_until timestamptz not null,
    status quotation_status not null default 'draft'::quotation_status,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz
);

-- F. Orders (Confirmed commercial commitments)
create table orders (
    id uuid primary key default gen_random_uuid(),
    quote_id uuid references quotations(id) on delete restrict,
    order_number varchar(50) not null,
    tenant_id uuid not null references tenants(id) on delete cascade,
    customer_id uuid not null references customers(id) on delete restrict,
    customer_name varchar(255) not null,
    phone varchar(15) not null,
    total_amount bigint not null default 0, -- Stored in paise (Int)
    status order_status not null default 'confirmed'::order_status,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz
);

-- G. Jobs (Shopfloor Work-In-Progress Tracker)
create table jobs (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete cascade,
    tenant_id uuid not null references tenants(id) on delete cascade,
    item_name varchar(255) not null,
    quantity integer not null check (quantity > 0),
    current_stage varchar(50) not null, -- Maps to code inside tenant.stage_configuration
    stages_history jsonb not null default '[]'::jsonb, -- Audit record: [{ stage: string, updatedBy: string, notes: string, updatedAt: string }]
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    deleted_at timestamptz
);

-- H. Dispatches (Vehicle delivery manifests)
create table dispatches (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references orders(id) on delete restrict,
    invoice_number varchar(50) not null,
    tenant_id uuid not null references tenants(id) on delete cascade,
    transporter varchar(255) not null,
    lr_number varchar(100) not null,
    vehicle_number varchar(30) not null, -- format e.g. "MH-12-PQ-4567"
    driver_name varchar(255),
    driver_phone varchar(15) not null,
    status dispatch_status not null default 'shipped'::dispatch_status,
    items jsonb not null default '[]'::jsonb, -- [{ name: string, quantity: number }]
    dispatched_at timestamptz not null default timezone('utc', now()),
    delivered_at timestamptz,
    deleted_at timestamptz
);

-- I. WhatsApp Outbox (Templated notifications log)
create table whatsapp_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    recipient_phone varchar(15) not null,
    recipient_name varchar(255) not null,
    type varchar(50) not null, -- 'RFQ_ACK', 'QUOTE_SENT', 'DISPATCH_ALERT'
    message text not null,
    bsp_message_id varchar(100), -- Gateway transaction key
    status whatsapp_log_status not null default 'pending'::whatsapp_log_status,
    timestamp timestamptz not null default timezone('utc', now())
);

-- J. Audit / Activity Log (Central monitoring console)
create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    user_name varchar(255) not null,
    action varchar(100) not null, -- 'COMPUTED_COST_SHEET', 'STAGE_ADVANCED'
    description text not null,
    timestamp timestamptz not null default timezone('utc', now())
);


-- ==========================================
-- 3. INDEXING PLAN (QUERY OPTIMIZATION)
-- ==========================================

-- Tenant isolation queries
create index idx_profiles_tenant on profiles(tenant_id);
create index idx_customers_tenant on customers(tenant_id) where deleted_at is null;
create index idx_rfqs_tenant_created on rfqs(tenant_id, created_at desc) where deleted_at is null;
create index idx_rfqs_status on rfqs(tenant_id, status) where deleted_at is null;
create index idx_quotations_tenant_created on quotations(tenant_id, created_at desc) where deleted_at is null;
create index idx_orders_tenant_created on orders(tenant_id, created_at desc) where deleted_at is null;
create index idx_jobs_tenant_stage on jobs(tenant_id, current_stage) where deleted_at is null;
create index idx_dispatches_tenant_status on dispatches(tenant_id, status) where deleted_at is null;
create index idx_whatsapp_logs_recipient on whatsapp_logs(tenant_id, recipient_phone, timestamp desc);
create index idx_audit_logs_timestamp on audit_logs(tenant_id, timestamp desc);

-- Unique logical business constraints per tenant
create unique index uq_rfq_number_tenant on rfqs(tenant_id, rfq_number) where deleted_at is null;
create unique index uq_quote_number_tenant on quotations(tenant_id, quote_number) where deleted_at is null;
create unique index uq_order_number_tenant on orders(tenant_id, order_number) where deleted_at is null;


-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable Row Level Security (RLS) across every schema table
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table customers enable row level security;
alter table rfqs enable row level security;
alter table quotations enable row level security;
alter table orders enable row level security;
alter table jobs enable row level security;
alter table dispatches enable row level security;
alter table whatsapp_logs enable row level security;
alter table audit_logs enable row level security;

-- Helper PG security functions to decode active Supabase JWT Custom Claims
create or replace function auth.get_tenant_id()
returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$$ language sql stable security definer;

create or replace function auth.get_user_role()
returns user_role as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '')::user_role;
$$ language sql stable security definer;


-- POLICIES: tenants
create policy "Users can view their own tenant profile"
    on tenants for select
    using (id = auth.get_tenant_id());

create policy "Only tenant admins can modify their company settings"
    on tenants for update
    using (id = auth.get_tenant_id() and auth.get_user_role() = 'admin');

-- POLICIES: profiles
create policy "Users can view teammate profiles under same tenant"
    on profiles for select
    using (tenant_id = auth.get_tenant_id());

create policy "Teammates can update their own personal profiles"
    on profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

create policy "Tenant admins can register/update profiles under their domain"
    on profiles for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() = 'admin');

-- POLICIES: customers (Operational data sandbox policies)
create policy "Multi-teammate customer master lookup isolation"
    on customers for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Sales, Management, Admin can record or update customer master files"
    on customers for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'sales', 'management'));

-- POLICIES: rfqs
create policy "Multi-teammate RFQ workflow isolation"
    on rfqs for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Sales, Management, Admin write/edit RFQ records"
    on rfqs for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'sales', 'management'));

-- POLICIES: quotations
create policy "Multi-teammate quotations workflow isolation"
    on quotations for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Sales, Management, Admin write/edit quotations records"
    on quotations for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'sales', 'management'));

-- POLICIES: orders
create policy "Multi-teammate orders workflow isolation"
    on orders for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Sales, Management, Admin write/edit order details"
    on orders for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'sales', 'management'));

-- POLICIES: jobs
create policy "Multi-teammate shop floor jobs tracking"
    on jobs for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Production Supervisors, Management, Admin advance shop stages"
    on jobs for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'production', 'management'));

-- POLICIES: dispatches
create policy "Multi-teammate tracking dispatches"
    on dispatches for select
    using (tenant_id = auth.get_tenant_id() and deleted_at is null);

create policy "Logistics Desk, Management, Admin manage shipping dispatches"
    on dispatches for all
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'dispatch', 'management'));

-- POLICIES: whatsapp_logs
create policy "Teammates can lookup client whatsapp notifications"
    on whatsapp_logs for select
    using (tenant_id = auth.get_tenant_id());

create policy "Application or Admin can append notification alerts logs"
    on whatsapp_logs for insert
    with check (tenant_id = auth.get_tenant_id());

-- POLICIES: audit_logs (Strict read restrictions)
create policy "Only management and admin can view complete plant audit files"
    on audit_logs for select
    using (tenant_id = auth.get_tenant_id() and auth.get_user_role() in ('admin', 'management'));

create policy "Internal trigger systems can log actions"
    on audit_logs for insert
    with check (tenant_id = auth.get_tenant_id());


-- ==========================================
-- 5. TRIGGERED LOG MECHANISMS (AUDIT LOGS & TIMESTAMP)
-- ==========================================

-- Auto-update updated_at timestamp helper
create or replace function update_modified_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$ language plpgsql;

create trigger update_tenants_modtime before update on tenants for each row execute procedure update_modified_column();
create trigger update_customers_modtime before update on customers for each row execute procedure update_modified_column();
create trigger update_rfqs_modtime before update on rfqs for each row execute procedure update_modified_column();
create trigger update_quotations_modtime before update on quotations for each row execute procedure update_modified_column();
create trigger update_orders_modtime before update on orders for each row execute procedure update_modified_column();
create trigger update_jobs_modtime before update on jobs for each row execute procedure update_modified_column();
create trigger update_dispatches_modtime before update on dispatches for each row execute procedure update_modified_column();


-- Automatic system wide trigger-driven audit logger
create or replace function process_audit_trigger()
returns trigger as $$
declare
    current_user_name varchar(255);
    active_tenant uuid;
    action_descr text;
begin
    -- Retrieve metadata context from session JWT claims or database records
    select coalesce(name, coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'email', 'System Engine'))
    into current_user_name
    from profiles
    where id = auth.uid();

    active_tenant := auth.get_tenant_id();
    if active_tenant is null then
        -- Fallback during Direct admin migrations via service rules
        active_tenant := coalesce(new.tenant_id, old.tenant_id);
    end if;

    if (TG_OP = 'INSERT') then
        action_descr := TG_TABLE_NAME || ' record created. ID: ' || new.id;
        insert into audit_logs(tenant_id, user_id, user_name, action, description)
        values (active_tenant, auth.uid(), coalesce(current_user_name, 'System'), 'CREATE', action_descr);
    elsif (TG_OP = 'UPDATE') then
        if (new.deleted_at is not null and old.deleted_at is null) then
            action_descr := TG_TABLE_NAME || ' soft-deleted. ID: ' || old.id;
            insert into audit_logs(tenant_id, user_id, user_name, action, description)
            values (active_tenant, auth.uid(), coalesce(current_user_name, 'System'), 'SOFT_DELETE', action_descr);
        else
            action_descr := TG_TABLE_NAME || ' record updated. ID: ' || old.id;
            insert into audit_logs(tenant_id, user_id, user_name, action, description)
            values (active_tenant, auth.uid(), coalesce(current_user_name, 'System'), 'UPDATE', action_descr);
        end if;
    elsif (TG_OP = 'DELETE') then
        action_descr := TG_TABLE_NAME || ' hard-deleted. ID: ' || old.id;
        insert into audit_logs(tenant_id, user_id, user_name, action, description)
        values (active_tenant, auth.uid(), coalesce(current_user_name, 'System'), 'HARD_DELETE', action_descr);
    end if;
    return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Bind audit operations to the major transition points in CRM
create trigger audit_customers_changes after insert or update or delete on customers for each row execute procedure process_audit_trigger();
create trigger audit_rfqs_changes after insert or update or delete on rfqs for each row execute procedure process_audit_trigger();
create trigger audit_quotations_changes after insert or update or delete on quotations for each row execute procedure process_audit_trigger();
create trigger audit_orders_changes after insert or update or delete on orders for each row execute procedure process_audit_trigger();
create trigger audit_jobs_changes after insert or update or delete on jobs for each row execute procedure process_audit_trigger();
create trigger audit_dispatches_changes after insert or update or delete on dispatches for each row execute procedure process_audit_trigger();
