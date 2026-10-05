# Supabase Auth Architecture & Migration Plan
**Product Module: Ashrey FlowOps**
**Tenant Access Control, Customs Claims, and Invite Workflows**

---

## 1. Auth Migration Strategy (Firebase to Supabase)

### 1.1 Credential & Data Export from Firebase Auth
Moving a live application with active accounts requires exporting the user database from Firebase Auth and loading it into Supabase’s PostgreSQL `auth.users` schema.

1.  **Export CLI Command**: Firebase CLI enables password hashes and user authentication entries dump:
    ```bash
    firebase auth:export accounts.json --format=json
    ```
2.  **Export Details Extracted**:
    *   `uid` (Firebase unique identifier string). Is retained as-is or mapped to new UUID values.
    *   `email` (Primary login entry).
    *   `passwordHash` (Bcrypt, Scrypt, or Argon2 hash, base64 encoded).
    *   `salt` (Cryptographic salt used to safely encrypt password).
    *   `phoneNumber` (User mobile number used for OTP logins).

### 1.2 Import to Supabase Auth
Supabase manages authentication inside a dedicated schema called `auth` in PostgreSQL. Users are loaded directly to the `auth.users` table using a backend migration script (using the service_role key).

#### Scrypt/Bcrypt Hash Integration
Supabase uses the `pgcrypto` library to verify encryption hashes.
*   **For Bcrypt profiles**: Set column `encrypted_password` to the hash value with type indicator.
*   **For Custom Firebase Scrypt hashes**: Write an import loader invoking the custom Scrypt algorithm options compatible with Supabase’s internal authentication provider (GoTrue).
*   **Fallback Alternative (Warm Migration)**: If hashes cannot be imported directly, require users to set or reset passwords on their first login or utilize email magic links to seamlessly verify sessions.

### 1.3 Phone OTP Mapping
For phone verification (OTP):
1.  Configure the Supabase SMS Provider (e.g., Twilio, Msg91, or Plivo) with target routes in India (+91).
2.  Map Firebase `phoneNumber` fields into `auth.users.phone` and set `phone_confirmed_at` to the current timestamp to bypass re-verification steps.

---

## 2. JWT Custom Claims Strategy

To enforce multi-tenancy at the database tier using Row Level Security (RLS) policies, we must make `tenant_id` and `role` credentials immediate parts of the JWT access tokens issued to browsers. This avoids querying the operational database on every network request.

### 2.1 The Supabase Token Hook Approach

Supabase Auth triggers a customized customizable database trigger on token issuance (`custom_claims_hook`). This hook appends claims to the authenticated token safely:

```sql
-- Create or replace token hooks schema
create or replace function auth.custom_access_token_hook(event jsonb)
returns jsonb as $$
declare
  claims jsonb;
  user_tenant_id uuid;
  user_role user_role;
begin
  -- Search for matching company and system bindings in the profiles table
  select tenant_id, role into user_tenant_id, user_role
  from public.profiles
  where id = (event->>'sub')::uuid;

  claims := event->'claims';

  if user_tenant_id is not null then
    -- Record permissions into claims payload
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id));
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  end if;

  -- Return updated event containing fresh secure context
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$ language plpgsql security definer;

-- Assign permissions
grant execute on function auth.custom_access_token_hook to supabase_auth_admin;
```

With this mechanism, whenever a client executes a query, the claims are extracted via `current_setting('request.jwt.claims')` in our RLS functions (`auth.get_tenant_id()` and `auth.get_user_role()`). This ensures zero database storage overhead during access check operations.

---

## 3. Invite-Based User Onboarding Flow

To expand tenant operations without exposing public signups, administrators invite teammates directly via a secure invite flow. This guarantees invitations are bound to their structural `tenant_id`.

```
[ Admin Console ]
        │
        ▼ (Post Invite request {email, name, role})
[ Supabase Edge / Vercel Serverless Function ]
        │
        ├─► 1. Invokes Supabase Admin Client (using service_role key)
        │      to create raw entry in auth.users (state: invited)
        │
        ├─► 2. Records user row inside public.profiles 
        │      mapping current tenant_id & selected raw user_role
        │
        ├─► 3. Compiles dynamic invitation URL with temporary token
        │
        ▼ (Sends onboarding email via Resend / SMTP)
[ Recipient Inbox ] ---> Cliks URL ---> Sets Password ---> Active
```

### 3.1 Step 1: Create invited user in auth.users (Server Code)
```ts
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { 
    tenant_id: tenantId, 
    role: role 
  },
  redirectTo: 'https://ashrey-flowops.vercel.app/onboarding/complete'
});
```

### 3.2 Step 2: Establish User Profile (Trigger-driven fallback or synchronous write)
```ts
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .insert({
    id: data.user.id,
    email: email,
    name: name,
    role: role,
    tenant_id: tenantId
  });
```

### 3.3 Step 3: Complete Sign-up Verification
When the invited team member clicks the email invitation URL, they are redirected to our onboarding form. This page contains their sign-in challenge where they choose their password and immediately boot into the workspace:

```ts
const { data, error } = await supabase.auth.updateUser({
  password: chooseSecurePassword
});
```
This activates the profile and initiates their multi-tenant workspace context instantly.
