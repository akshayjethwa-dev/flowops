# Firestore Data Model & Schema Specification
## Project: Ashrey FlowOps (MVP)
### Document Version: 1.0.0
### Date: May 30, 2026

This document defines the production-ready Cloud Firestore database schema, collection hierarchies, document-level validation rules, indexing patterns, and security strategies for **Ashrey FlowOps**.

---

## 1. Architectural Strategy & Multi-Tenant Isolation

### 1.1 Cohesive Isolation Model we selected
We adopt a **Hierarchical Tenant Subcollection Architecture** under a root `/tenants` collection for all operational datasets, supplemented by a flat root `/users` (Profiles) directory. 

*   **Operational Directories (Subcollections)**: Nested within `/tenants/{tenantId}/[collection]`. This structures sub-tenants logically, permits clean recursive data exports/purges, and translates into high-performance security scoping where tenant wildcards naturally enforce strict sandbox barriers.
*   **Tenant Mapping Directories (Root)**: The `/users` profile collection is flat at root, referencing its designated `tenantId` as a top-level field. During auth handshakes, this document is queried immediately to determine the active tenant sandbox layout.

```
/users (root)
  └── {userId} (profile doc referencing tenantId)

/tenants (root)
  └── {tenantId} (tenant metadata config)
        ├── customers (subcollection)
        ├── rfqs (subcollection)
        ├── quotations (subcollection)
        ├── orders (subcollection)
        ├── jobs (subcollection)
        ├── dispatches (subcollection)
        ├── whatsapp_logs (subcollection)
        └── activity_logs (subcollection)
```

### 1.2 Naming Conventions
*   **Collections**: All paths use snake_case plural labels (e.g., `whatsapp_logs`, `activity_logs`).
*   **Document IDs**:
    *   System-generated structural documents use standard random 20-character base64 Firestore IDs.
    *   **Human-Readable Display IDs**: Unique human-readable prefixes are stored inside documents for display in communication, sorting, and UI searches. These follow serial formats, maintaining a yearly epoch scheme:
        *   RFQs: `RFQ-2026-0001`, `RFQ-2026-0002`
        *   Quotations: `QTN-2026-0001`, `QTN-2026-0002`
        *   Orders: `ORD-2026-0001`, `ORD-2026-0002`
        *   Dispatches: `DSP-2026-0001`, `DSP-2026-0002`
*   **Attributes (Fields)**: Lower camelCase (e.g., `customerName`, `totalAmount`, `isFinalStage`).

---

## 2. Global Root Collections

### 2.1 Collection: `/users` (Profiles Directory)
Flat root-level collection mapping Google authenticated accounts (`uid` matches Firebase Auth `uid`) to roles and sandboxes.

*   **Path**: `/users/{userId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `uid` | string | Yes | Firebase Auth Key (`"auth_user_abc123"`) |
| `email` | string | Yes | Login email identifier (`"supervisor_karan@gmail.com"`) |
| `name` | string | Yes | Human full name (`"Karan Rawat"`) |
| `role` | string | Yes | Enum: `"admin"`, `"sales"`, `"production"`, `"dispatch"`, `"management"` |
| `tenantId` | string | Yes | Link to Tenant metadata (`"tenant_bharat_gears"`) |
| `createdAt` | timestamp | Yes | System document creation mark (`2026-05-30T05:47:00Z`) |
| `lastActive` | timestamp | No | Last authenticated operation check (`2026-05-30T05:47:00Z`) |

---

### 2.2 Collection: `/tenants` (Tenant Metadata / Stage Configuration)
Houses company metadata and centralizes custom variables like configured physical shopfloor stages.

*   **Path**: `/tenants/{tenantId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Unique ID string (`"tenant_bharat_gears"`) |
| `companyName` | string | Yes | Registered brand name (`"Bharat Gears & Castings Ltd."`) |
| `gstin` | string | Yes | B2B Commercial identity tax code (`"24AAACB1201A1Z1"`) |
| `sandboxMode` | boolean | Yes | Flags temporary sandbox entities (`false`) |
| `createdAt` | timestamp | Yes | Initial boot date stamp |
| `stageConfiguration` | array (map) | Yes | Configurable ordered list of shop stages (details below) |

#### Nesting Model: `stageConfiguration` Map
To make production workflow stations flexible, tenants govern their shop floor stages directly within this configuration. Jobs reference these configuration codes.

```json
"stageConfiguration": [
  { "code": "pattern_shop", "label": "Pattern Shop", "sequence": 1, "isFinalStage": false },
  { "code": "molding", "label": "Molding & Casting", "sequence": 2, "isFinalStage": false },
  { "code": "machining", "label": "CNC Machining", "sequence": 3, "isFinalStage": false },
  { "code": "quality_audit", "label": "Quality Audit", "sequence": 4, "isFinalStage": false },
  { "code": "ready", "label": "Ready for Dispatch", "sequence": 5, "isFinalStage": true }
]
```

---

## 3. Nested Tenant Subcollections (Operational Data)

### 3.1 Subcollection: `/tenants/{tenantId}/customers`
Conserves the customer and dealer master directory files.

*   **Path**: `/tenants/{tenantId}/customers/{customerId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Sub-doc UI ID key |
| `tenantId` | string | Yes | Crosscheck tenant field matching path key |
| `companyName` | string | Yes | Corporate or dealership name (`"Gujarat Lathe Corporation"`) |
| `contactPerson` | string | Yes | Point of contact supervisor (`"Animesh Patel"`) |
| `phone` | string | Yes | WhatsApp mobile with country prefix (`"919876543210"`) |
| `email` | string | No | Email invoice dispatch (`"purchases@gujaratlathe.co.in"`) |
| `gstin` | string | No | Customer tax identity, optional for simple dealers (`"24BBBCB3101E1Z5"`) |
| `billingAddress` | map | Yes | Format: `{ street: string, city: string, state: string, zip: string }` |
| `dealerTier` | string | Yes | Enum: `"standard"`, `"silver"`, `"gold"` (tier triggers baseline checks) |
| `createdAt` | timestamp | Yes | Capture index stamp |

---

### 3.2 Subcollection: `/tenants/{tenantId}/rfqs`
Registers raw customer inquiries or demands before officially pricing.

*   **Path**: `/tenants/{tenantId}/rfqs/{rfqId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | System auto ID |
| `rfqNumber` | string | Yes | Display code (`"RFQ-2026-0056"`) |
| `tenantId` | string | Yes | Tenant scoping reference |
| `customerId` | string | Yes | Link to customer master directory |
| `customerName` | string | Yes | Redundant customer display snapshot |
| `phone` | string | Yes | Target notification path (`"919876543210"`) |
| `requirements` | string | No | Raw contextual notes, special heat directions, etc. |
| `items` | array (map) | Yes | List of component demands: `{ name: string, quantity: number }` |
| `status` | string | Yes | Enum: `"pending"`, `"quoted"`, `"declined"` |
| `createdAt` | timestamp | Yes | Trigger stamp |

---

### 3.3 Subcollection: `/tenants/{tenantId}/quotations`
Cost Sheets calculated by the sales panel, incorporating specific technical components and tax valuations.

*   **Path**: `/tenants/{tenantId}/quotations/{quotationId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Document identifier |
| `rfqId` | string | Yes | Link to parent user RFQ inquiry document |
| `quoteNumber` | string | Yes | Registered code document (`"QTN-2026-0042"`) |
| `tenantId` | string | Yes | Tenant lock key |
| `customerId` | string | Yes | Customer reference ID |
| `customerName` | string | Yes | Customer name |
| `phone` | string | Yes | Notification target |
| `items` | array (map) | Yes | Details of material pricing breakdown (details below) |
| `subtotal` | number | Yes | Base financial sum (`154000`) |
| `gstAmount` | number | Yes | Standardized 18% CGST + SGST tax metric (`27720`) |
| `total` | number | Yes | Full aggregate costing cost estimate (`181720`) |
| `validUntil` | timestamp | Yes | Expiry target of quote pricing |
| `status` | string | Yes | Enum: `"draft"`, `"sent"`, `"approved"`, `"declined"` |
| `createdAt` | timestamp | Yes | Creation index |

#### Nesting Model: `items` (Detailed Quotation Elements Schema)
```json
"items": [
  {
    "name": "Heavy Foundry Casting Ring - Size A",
    "quantity": 100,
    "unitPrice": 1200,
    "total": 120000
  },
  {
    "name": "Surface Lathe Polishing Charge",
    "quantity": 100,
    "unitPrice": 340,
    "total": 34000
  }
]
```

---

### 3.4 Subcollection: `/tenants/{tenantId}/orders`
Operational Purchase Orders generated upon quotation approval, keeping aggregate financial tallies.

*   **Path**: `/tenants/{tenantId}/orders/{orderId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Document ID |
| `quoteId` | string | Yes | Originating Quotation link |
| `orderNumber` | string | Yes | Display code (`"ORD-2026-0031"`) |
| `tenantId` | string | Yes | Scoping reference |
| `customerId` | string | Yes | Client link ID |
| `customerName` | string | Yes | Customer company name |
| `phone` | string | Yes | WhatsApp contact receiver |
| `totalAmount` | number | Yes | Extracted grand total amount (`181720`) |
| `status` | string | Yes | Enum: `"confirmed"`, `"dispatched"`, `"completed"` |
| `createdAt` | timestamp | Yes | Activation date |

---

### 3.5 Subcollection: `/tenants/{tenantId}/jobs`
The core **Shopfloor Work-In-Progress (WIP)** tracking unit. Every line item from a confirmed purchase order spawns an individual `Job` record in this subcollection.

*   **Path**: `/tenants/{tenantId}/jobs/{jobId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Document database key |
| `orderId` | string | Yes | Link to spawning B2B Purchase Order doc |
| `tenantId` | string | Yes | Scoping check key |
| `itemName` | string | Yes | Concrete part name (`"Heavy Foundry Casting Ring - Size A"`) |
| `quantity` | number | Yes | Total lot units required (`100`) |
| `currentStage` | string | Yes | Reference code to template stage (`"machining"`) |
| `stagesHistory` | array (map) | Yes | Comprehensive audit log track of supervisor shifts |
| `updatedAt` | timestamp | Yes | Last station shift step index |

#### Nesting Model: `stagesHistory` (Shopfloor Activity Audit)
This structure allows tracking precisely who, what, when, and where was advanced, recording comments and digital parameter checks.

```json
"stagesHistory": [
  {
    "stage": "pattern_shop",
    "updatedBy": "karan_supervisor",
    "notes": "Original mold pattern cast verified. Commencing foundry run.",
    "updatedAt": "2026-05-30T01:12:00Z"
  },
  {
    "stage": "molding",
    "updatedBy": "karan_supervisor",
    "notes": "Molten alloy components cooled. Batch looks clean.",
    "updatedAt": "2026-05-30T04:30:00Z"
  }
]
```

---

### 3.6 Subcollection: `/tenants/{tenantId}/dispatches`
Outward logistics manifests containing driver parameters, vehicle license numbers, and Lorry Receipt (LR) tracking references.

*   **Path**: `/tenants/{tenantId}/dispatches/{dispatchId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Document index |
| `orderId` | string | Yes | Parent Purchase Order doc |
| `invoiceNumber` | string | Yes | Retail billing transaction code (`"FY26-INV-1035"`) |
| `tenantId` | string | Yes | Structural sandbox check |
| `transporter` | string | Yes | Freight agency name (`"VRL Logistics India"`) |
| `lrNumber` | string | Yes | Lorry Receipt tracking number (`"LR-984210"`) |
| `vehicleNumber` | string | Yes | Indian format trailer plates (`"GJ-06-ZZ-4012"`) |
| `driverName` | string | No | Operator identity (`"Shivraj Kumar"`) |
| `driverPhone` | string | Yes | Driver tracking cell contact (`"919999888877"`) |
| `status` | string | Yes | Enum: `"shipped"`, `"delivered"` |
| `items` | array (map) | Yes | Cargo bundle pack list: `{ name: string, quantity: number }` |
| `dispatchedAt` | timestamp | Yes | Depature dock stamp |
| `deliveredAt` | timestamp | No | Arrival destination dock stamp |

---

### 3.7 Subcollection: `/tenants/{tenantId}/whatsapp_logs`
Outbox archive keeping complete traces of templated campaigns sent via BSP webhook paths.

*   **Path**: `/tenants/{tenantId}/whatsapp_logs/{logId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Log database key |
| `tenantId` | string | Yes | Isolation key |
| `recipientPhone` | string | Yes | Target routing with country prefix |
| `recipientName` | string | Yes | Target client name snapshot |
| `type` | string | Yes | Trigger label (e.g., `"RFQ_ACK"`, `"QUOTE_SENT"`, `"DISPATCH_ALERT"`) |
| `message` | string | Yes | Generated plaintext content compiled via template payload |
| `bspMessageId` | string | No | Response ID from delivery gateway to check delivery status hooks |
| `status` | string | Yes | Enum: `"pending"`, `"sent"`, `"delivered"`, `"failed"` |
| `timestamp` | timestamp | Yes | Send event index |

---

### 3.8 Subcollection: `/tenants/{tenantId}/activity_logs`
Generic platform audit footprint tracking actions for system state assurance.

*   **Path**: `/tenants/{tenantId}/activity_logs/{logId}`
*   **Fields**:

| Field Name | Type | Required | Description / Example |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | Log doc reference |
| `tenantId` | string | Yes | Dynamic isolation stamp |
| `userId` | string | Yes | Profile creator ID (`"auth_user_abc123"`) |
| `userName` | string | Yes | Human modifier snapshot |
| `action` | string | Yes | Action key (e.g., `"COMPUTED_COST_SHEET"`, `"DELIVERED_FREIGHT"`) |
| `description` | string | Yes | Context notes of transaction |
| `timestamp` | timestamp | Yes | Trigger date check |

---

## 4. Query Analysis & Composite Index Requirements

To safeguard UI components from slow fetch patterns or console crash loops, Firestore requires the following multi-index layout declarations.

### 4.1 Index Table for Typical Queries

| Source Collection | Target Fields (Order) | Sort Order | Query Context / Purpose |
| :--- | :--- | :--- | :--- |
| **`rfqs`** | `status` (Ascending) <br> `createdAt` (Descending) | Mixed | Filters outstanding RFQ hoppers by status, sorting newest first. |
| **`quotations`** | `customerId` (Ascending) <br> `createdAt` (Descending) | Mixed | Identifies commercial pipeline history of specific dealers. |
| **`jobs`** | `currentStage` (Ascending) <br> `updatedAt` (Descending) | Mixed | Identifies loading on specific shop machines, sorting by active delay. |
| **`dispatches`** | `status` (Ascending) <br> `dispatchedAt` (Descending) | Mixed | Displays on-road road freight trackers. |
| **`whatsapp_logs`** | `recipientPhone` (Ascending) <br> `timestamp` (Descending) | Mixed | Fetches notification trace history for audit records. |

---

## 5. Security Rules & Query Scoping Strategies

To prevent unauthorized read operations and data leakage, access mechanics are strictly governed at physical database layers.

### 5.1 Rules Structural Logic
1.  **Read user context directly**: Every read/write transaction evaluates `get(/databases/$(database)/documents/users/$(request.auth.uid)).data`.
2.  **Verify matched scope**: Rules verify that the matched record's `tenantId` property equals the user profile `tenantId`.
3.  **Prevent "List Everything" Queries**: Client-side queries are **forbidden** from executing broad root reads. Read queries are structured with strict tenant constraints to protect client boundaries:
    *   `db.collection("tenants").doc(userTenantId).collection("rfqs")` (Valid)
    *   `db.collectionGroup("rfqs")` (Blocked - fails security rules)

### 5.2 High-Level Security Rule Layout
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Core User mapping verification helper
    function getProfile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Tenant metadata config rule mapping
    match /tenants/{tenantId} {
      allow read: if request.auth != null && getProfile().tenantId == tenantId;
      allow write: if request.auth != null && getProfile().tenantId == tenantId && getProfile().role == "admin";

      // General Rule for nested shopfloor collections
      match /{subcollection}/{docId} {
        allow read, write: if request.auth != null && getProfile().tenantId == tenantId;
      }
    }

    // Profile database record access checking
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (request.auth.uid == userId || getProfile().role == "admin");
    }
  }
}
```
