# Security Specification for Ashrey FlowOps

This document defines the zero-trust data invariants, the "Dirty Dozen" attack payloads, and the corresponding security policies designed to prevent multi-tenant data leaks and unauthorized state manipulation.

## Data Invariants

1. **Multi-Tenant Boundary**: No user can read, list, create, update, or delete records belonging to another tenant (`tenantId`).
2. **Role-Based Workflows**:
   - Only `admin`, `sales`, and `management` roles may create RFQs and Quotes.
   - Only `admin`, `sales`, and `management` roles may view and advance Quotes to Orders.
   - Only `admin`, `production`, and `management` roles can update Production Jobs.
   - Only `admin`, `dispatch`, and `management` roles can create and update Dispatch detail sheets.
3. **Immutability Invariant**: Structural ID references (`tenantId`, `id`, `rfqId`, `quoteId`, `orderId`) are immutable once created.
4. **Temporal Security**: All creation times (`createdAt`, `dispatchedAt`) and updates (`updatedAt`) must strictly match `request.time`.

---

## The "Dirty Dozen" Threat Vectors & Rejection Criteria

Below are the 12 specific exploit payloads that Ashrey FlowOps firestore security rules must synchronously reject.

| # | Exploit Target | Payload Attempt | Security Rule Control | Expected Result |
|---|----------------|-----------------|----------------------|-----------------|
| 1 | Multi-Tenant Leak | Read RFQ belonging to `tenant_999` while active user belongs to `tenant_111`. | `resource.data.tenantId == getUserTenantId()` | **PERMISSION_DENIED** |
| 2 | Self-Elevated Privilege | Write role `admin` directly inside own `/users/{userId}` doc on signup. | `!incoming().keys().hasAny(['role'])` or verified creator rules. | **PERMISSION_DENIED** |
| 3 | Role Bypass (Sales in Dispatch) | Sales personnel issuing Dispatch Slip. | `getUserRole() in ['admin', 'dispatch', 'management']` | **PERMISSION_DENIED** |
| 4 | Ghost Fields | Creating Quote with unauthorized payload key containing `debug_bypass_admin: true`. | `.keys().hasAll(...) && .keys().size() == N` | **PERMISSION_DENIED** |
| 5 | Price Spoofing | Updating confirmed order total from `₹50,000` to `₹0`. | Terminal state locking & action-based updates | **PERMISSION_DENIED** |
| 6 | Identity Hijack | Creating an RFQ where `createdBy` does not match the requester's UID. | `incoming().createdBy == request.auth.uid` | **PERMISSION_DENIED** |
| 7 | Temporal Forgery | Specifying a block timestamp backdated by 1 year. | `incoming().createdAt == request.time` | **PERMISSION_DENIED** |
| 8 | Invalid ID Poisoning | Requesting document matching `../rfqs/some-extremely-long-string-attack` to blow up query cache. | `isValidId(rfqId)` | **PERMISSION_DENIED** |
| 9 | State Shortcutting | Forcing order status directly from `pending` to `completed` bypassing production stages. | Explicit permitted state transitions / actions | **PERMISSION_DENIED** |
| 10| Unverified Email Write | Trying to perform database writes using a fake Google account without verification. | `request.auth.token.email_verified == true` | **PERMISSION_DENIED** |
| 11| Orphaned Quotes | Quote injected without referencing the parent RFQ ID. | `exists(/databases/$(database)/documents/rfqs/$(incoming().rfqId))` | **PERMISSION_DENIED** |
| 12| PII Scrape Sweep | Blanket query search over all users without filtering tenant-scoped IDs. | Secure list queries matching resource field | **PERMISSION_DENIED** |

---

## Production Security Gates

We enforce zero-trust Attribute-Based Access Control (ABAC) in `firestore.rules`. Access is granted strictly if users are authenticated, email-verified, belong to the tenant, and possess the correct role.
