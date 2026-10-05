# Product Requirements Document (PRD)
## Project Name: Ashrey FlowOps
### Document Version: 1.0.0 (MVP Specification)
### Date: May 30, 2026

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
In the Indian Small and Medium Enterprise (SME) manufacturing and foundry industrial sector, operations are typically managed using a highly fragmented patchwork of tools: physical chalkboards, paper registers, unorganized WhatsApp groups, and desktop-bound Tally ERP systems. While Tally successfully handles compliance and accounting, it fails to model the high-velocity operational realities of the shopfloor and customer touchpoints.

### 1.2 The Problem
Ashrey FlowOps addresses five core operational failures that bottleneck Indian manufacturing growth:
1. **RFQ Inefficiency**: Inquiries coming from industrial dealers and B2B customers over WhatsApp and phone calls are lost in personal chats. Sales representatives lack a consolidated hopper, leading to slow quotation times.
2. **Production Blindspots**: Once a quote is accepted, shopfloor supervisors execute casting, molding, milling, and CNC machining operations without direct feedback with the sales team. Sales representatives must physically walk down to the assembly line to fetch simple progress cards.
3. **Dealer & Customer Friction**: Traditional dealer networks require periodic updates. Sales teams spend hours calling supervisors and drafting WhatsApp messages manually to update clients on order readiness.
4. **Dispatch & Transit Chaos**: Transporter coordination, Lorry Receipt (LR) logs, and driver details are kept in paper registers. Lost transit paperwork leads to delayed payments and customer disputes.
5. **Lack of Management Visibility**: Company owners and executive directors have no real-time dashboard showing the company's financial funnel or line efficiency. They often only learn of delays during delayed billing cycles.

### 1.3 Solution Statement
**Ashrey FlowOps** is an agile, multi-tenant B2B operations CRM that acts as a real-time intermediate layer between customer-facing relationships and shopfloor execution. By digitizing the workflow beginning from **RFQ reception**, extending down into **structured Shopfloor Stations**, and concluding at **Outbound Dispatch Slips**—with **automated WhatsApp outreach (via AiSensy template APIs)** at critical state changes—Ashrey FlowOps removes operational latency and delivers a single source of truth for both industrial leadership and their external networks.

---

## 2. Product Goals & Non-Goals

### 2.1 Strategic MVP Goals
*   **Centralize the Operations Pipeline**: Transition the business from paper and manual spreadsheets into a deterministic, single-view software pipeline.
*   **Eradicate Communication Overhead**: Standardize client notifications using a trigger-based WhatsApp BSP engine (simulated via local outbox with webhook hooks).
*   **Empower the Shop Floor Supervisor**: Design ultra-simplified, mobile-friendly forms requiring minimal technical proficiency to advance job stages.
*   **Provide Financial Funnel Clarity**: Feed physical activities (RFQs, Billing, WIP value, Dispatched Freight) directly into a financial estimation view for executive management.
*   **Ensure Tenant Isolation**: Develop a database structure that supports complete multi-tenant sub-tenant logical safety.

### 2.2 Explicit Non-Goals (Out of Scope for MVP)
*   **General Ledger Accounting**: No journals, double-entry ledgers, balance sheets, or tax filers. Tally acts as the master accounting source.
*   **Inventory & Stock Valuation**: No tracking of raw scrap, alloy ratios, or sand bins inside raw stores. Focus is on *work WIP status tracing* and *ordered products*.
*   **Native App Packaging**: The app is designed as a progressive web application (PWA) accessed via browser. It will not be deployed to the iOS/Android App Store.
*   **Complex Material Requirements Planning (MRP)**: No automated bill-of-materials calculations tied to global steel markets.
*   **Automatic WhatsApp Chat Sandbox**: We do not configure inbound conversational AI or direct chat routing inside this specific web application.

---

## 3. Target User Roles & Personas

| Role Name | Primary Objective | Key Technical/Visual Requirement |
| :--- | :--- | :--- |
| **Admin / Company Owner** | Setting up tenant specifications (GSTIN, company, locations) and managing logins. | Absolute control over user creation, access overrides, and subscription billing. |
| **Sales / Commercial Desk** | Capturing raw incoming inquiries, pricing line items, and sharing official quotations. | Desktop-optimized dense tables, batch inputs, and rapid WhatsApp dispatch hooks. |
| **Shopfloor Supervisor** | Tracing casting molds, CNC milling runs, quality audits, and marking components as ready. | Simplified, single-click touch targets, low-light optimized mobile interface. |
| **Dispatch / Stores Manager** | Bundling complete orders, printing Lorry Receipts (LR), and tracking driver/vehicle details. | Linear checklists showing only "completely ready" items with fast transit validation forms. |
| **Management / Director** | Monitoring total pipeline valuation, active shop workloads, and bottlenecks. | High-contrast visual bento-grids and real-time trend indications. |
| **External Dealer (Future Phase)** | Submitting order requests and watching transit statuses directly. | High-security containment, basic mobile catalog, and read-only progress bars. |

---

## 4. MVP Core Module Specifications

```
+---------------------------------------------------------------------------------+
|                                 ASHREY FLOWOPS                                  |
|                                                                                 |
| 1. Tenancy RBAC ---> 2. Customer Master ---> 3. RFQ Intake ---> 4. Quotation UI  |
|                                                                       |         |
| 7. Management Dashboard <--- 6. WhatsApp Gate <--- 5. Dispatch  <-- 4. Order    |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### Module 1: Multi-Tenant & User Access Control (RBAC)
*   **Functional Requirements (FRs)**:
    *   System must handle logical isolation of database collections based on a `tenantId`.
    *   Dynamic Profile registration allowing members to load defined profiles: `Sales`, `Production`, `Dispatch`, or `Management`.
    *   Sandbox/Demo bootstrap workflow: If an unauthenticated user enters, they can enter a sandbox company parameter and immediately spawn pre-loaded mock state to prevent login deadlocks during demonstrations.
*   **Non-Functional Requirements (NFRs)**:
    *   Complete sub-tenant security checks on all document fetches (no leakage across company ids).
    *   Auth checks completed safely inside the routing lifecycle before rendering core panels.
*   **UI/UX and Mobility**:
    *   Clean minimal login page containing integrated Google login and a prominent **"Launch Demo Sandbox"** action card.
    *   Accessible persistent "Switch Role Panel" widget nested inside the bottom of the navigation to allow operators to swap personas on the fly.
*   **Conceptual Data Entities**:
    *   `Profile`: `uid`, `name`, `email`, `role`, `tenantId`, `createdAt`.
    *   `Tenant`: `id`, `companyName`, `gstin`, `sandboxMode`, `createdAt`.

### Module 2: B2B Customer & Dealer Directory (Master)
*   **Functional Requirements (FRs)**:
    *   Maintain a unified master dataset of all regular customers, regional steel dealers, and commercial agencies.
    *   Record business identity params: GST Register status, shipping hubs, default mobile phone contact for WhatsApp.
    *   Search and filter capability over customers directly inside RFQ intake screens.
*   **Non-Functional Requirements (NFRs)**:
    *   Autosuggest lists must resolve in <30ms to maintain fluid user experiences during active phone inquiries.
*   **UI/UX and Mobility**:
    *   Card layouts featuring high-contrast badges for regular/high-volume clients.
    *   Click-to-call and quick-copy WhatsApp targets integrated.

### Module 3: Sales, RFQ Intake & B2B Quotation CRM
*   **Functional Requirements (FRs)**:
    *   **RFQ Entry**: Rapid capture of raw customer specifications. Supports line items specifying component name and quantity.
    *   **Commercial Quotation Builder**: Allows a sales executive to choose an active RFQ and specify:
        *   Industrial line-item pricing (molding/material costs per unit).
        *   Dynamic 18% GST auto-calculation (9% SGST + 9% CGST).
        *   Configurable quotation validity durations (15, 30, or 60 days).
    *   **Quotation Flow**: State machine controls transitioning status from `draft` -> `sent` -> `approved` or `declined`.
    *   **Conversion to Order**: Upon approval, a single click automatically spawns a confirmed Purchase Order and sets up corresponding Jobs in the Production module.
*   **Non-Functional Requirements (NFRs)**:
    *   Automated mathematical validations preventing negative unit prices or negative quantities.
*   **UI/UX and Mobility**:
    *   Slide-out drawer or responsive toggle cards for adding/removing technical line items.
    *   High-contrast color indicators for states: Pending (Orange), Quoted (Sky), Approved (Green).

### Module 4: Order & Shopfloor Production Stage Supervisor
*   **Functional Requirements (FRs)**:
    *   **Purchase Orders**: Formed upon Quotations Approval. Includes scheduled tracking code references.
    *   **Production Stages / Stations**: Every item in a confirmed order spawns a tracking line. The supervisor can advance these through the defined physical stages:
        *   `pattern_shop` (Molds Production)
        *   `molding` (Pouring/Foundry)
        *   `machining` (CNC / Surface Lathe tuning)
        *   `quality_audit` (Micrometer check and testing)
        *   `ready` (Yield finalized for Dispatch)
    *   **Station Updates**: Supervisors can append specialized notes per stage advance (e.g. *"Dimensions verified by digital caliper. Transferred for milling."*).
*   **Non-Functional Requirements (NFRs)**:
    *   Once an item is marked `ready`, it must lock itself from further stage adjustments and flag itself inside the Dispatch registry.
*   **UI/UX and Mobility**:
    *   Large, chunky action targets formatted explicitly for supervisors wearing safety gloves or monitoring via mobile device.
    *   Detailed updates logs showing exactly when an item shifted stations and who authorized it.

### Module 5: Dispatch Logistics & Outbound Lorry Tracking
*   **Functional Requirements (FRs)**:
    *   **Ready Queue**: Displays list of confirmed Purchase Orders where *all* associated component lines are `ready`.
    *   **Compilation forms**: Dispatch clerks compile outbound Lorry Receipts (LR):
        *   Tax Invoice Number Reference.
        *   Transporter Partner selection.
        *   Lorry tracking and vehicle registration license.
        *   Driver Name and phone contact detail.
    *   **Delivered Hook**: Upon actual delivery arrival, the user registers delivery confirmation, closing the shipping life-cycle.
*   **Non-Functional Requirements (NFRs)**:
    *   Lorry vehicles must adhere to standard regional plate validation concepts (visual checks).
*   **UI/UX and Mobility**:
    *   Dense logistics manifest page. Includes progress meters demonstrating shipped values versus active road cargo.

### Module 6: WhatsApp Outbound Notification Engine
*   **Functional Requirements (FRs)**:
    *   Trigger-based messaging mapped directly to operational steps:
        1.  **RFQ Received**: Sent when sales rep logs a new inquiry.
        2.  **Quotation Shared**: Sent when quotation changes from `draft` to `sent` (provides deep link or cost details).
        3.  **Order Confirmed**: Sent when quotation transforms into active fabrication.
        4.  **Production Updates**: Triggered when a shopfloor supervisor advances stages.
        5.  **Dispatch Loading**: Includes transporter agency, LR tracker number, vehicle, and driver phone details.
        6.  **Trip Delivered**: Notifies customer of successful offloading.
    *   **Audit Vault**: Maintain an outbound dispatch log register showing recipient name, phone, message content template, timestamps, and delivery success metrics.
*   **Non-Functional Requirements (NFRs)**:
    *   Graceful degradation of services: If a WhatsApp API returns errors or fails, the application wrapper must capture exceptions cleanly, store details in the database audit log, and permit standard operations without freezing the local UI.

### Module 7: Management Command Center Dashboard
*   **Functional Requirements (FRs)**:
    *   Real-time analytical calculators aggregating:
        *   **Awaiting Cost Approval**: Total financial sum of outstanding active quotes (Commercial pipeline).
        *   **WIP Shopfloor Value**: Accumulated materials cost index of lots active in the casting or machining stages.
        *   **Outward Shipped Revenue**: Capital value confirmed as dispatched or completed across the shift.
    *   **Visual Charts**: Comparative flow visualization demonstrating actual throughput from RFQs through to final invoice delivery.
*   **Non-Functional Requirements (NFRs)**:
    *   Aggregated KPIs must update automatically whenever documents inside sub-collections change, avoiding manual reload operations.
*   **UI/UX and Mobility**:
    *   Clean, minimalist bento-grid structure. Highlights critical status alerts and shop floor capacity indexes.

---

## 5. "Day in the Life" Operational Workflows

### 5.1 Workflow A: Sales Representative (Quotation-to-Cash)
1.  **09:30 AM**: Sales clerk receives a PDF specification over WhatsApp from **Gujarat Lathe Corporation**. She clicks "Capture New RFQ" on the dashboard, searches Gujarat Lathe, sets details, and inputs: "Casting Gear Ring - Qty: 200".
2.  **09:32 AM**: The system automatically triggers a WhatsApp "RFQ Acknowledged" notification to Gujarat Lathe's operator.
3.  **10:00 AM**: Sales team reviews the patterns. She enters the pricing interface inside active RFQs: Materiel base at ₹1,200/unit, Machining at ₹300/unit. Total baseline is auto-calculated with CGST/SGST taxes.
4.  **10:15 AM**: Sales team clicks "Publish Commercial Quote". The quotation status changes to `sent`. Customers receive a direct costing sheet via automated WhatsApp link.
5.  **02:00 PM**: Customer calls to approve the pricing. A single click on the "Approve Quotation" button converts the quote into a Purchase Order. The system spawns 200 production tasks under Molding and Pattern divisions automatically.

```
+------------+     +-------------------+     +------------------+     +------------------+
| Create RFQ | --> | WhatsApp Ack Sent | --> | Calculate Quot.  | --> | WhatsApp Quote   |
+------------+     +-------------------+     +------------------+     +------------------+
                                                                               |
                                                                               v
+------------+     +-------------------+     +------------------+     +------------------+
| Jobs Spawn | <-- | Shopfloor Active  | <-- | Approve Purchase | <-- | Customer Accepts |
+------------+     +-------------------+     +------------------+     +------------------+
```

### 5.2 Workflow B: Shopfloor Supervisor (Daily Assembly Stations)
1.  **07:00 AM**: The supervisor logs in on his smartphone at the foundry gates. Under "Active Component Lines (WIP)", he filter-views all pending Casting jobs.
2.  **11:30 AM**: Batch 1205 (Casting Gear Ring - 200 units) finishes heat treatment molds. The supervisor clicks "Advance Stage" on his smartphone, moves the slider from `molding` to `machining`, and types: *"Molding clean. Moving to Lathe-02."*
3.  **11:31 AM**: The client receives a WhatsApp notification indicating their order has advanced cleanly to CNC Tuning.
4.  **04:00 PM**: Machine operations and quality audit checks conclude. The supervisor updates the final stage to `ready`. The item locks and vanishes from his WIP board, showing up instantly inside Stores and Dispatch manifests.

### 5.3 Workflow C: Management Dashboard Audit
1.  **08:00 AM**: The Managing Director logs in over coffee. The bento dashboard provides four clear indices:
    *   Current RFQs awaiting pricing.
    *   Valuation value of raw components active in machining.
    *   Expected monthly dispatched collections.
2.  **08:05 AM**: He reviews the "WhatsApp Audit Feed" to confirm system communications are streaming perfectly without system lag.

---

## 6. Engineering Requirements & Tenant Security Details

### 6.1 Multi-Tenant Safety Mandate
Under no operational circumstances should any user of Tenant A view, edit, search, or access records belonging to Tenant B. All Firestore read/write expressions are governed by strict metadata-based tenancy checks.

```javascript
// Conceptual Tenancy Rule Representation
match /databases/{database}/documents/{collection}/{document} {
  allow read, write: if request.auth != null && resource.data.tenantId == request.auth.token.tenantId;
}
```

### 6.2 Data Schema Blueprint (Conceptual Entity Models)

```
                            +-------------------+
                            |      Tenant       |
                            +-------------------+
                                      | 1
                                      |
                                      v *
                            +-------------------+
                            |      Profile      |
                            +-------------------+
                                      | 1
                                      |
                                      v *
                            +-------------------+
                            |        RFQ        |
                            +-------------------+
                                      | 1
                                      |
                                      v 1
                            +-------------------+
                            |     Quotation     |
                            +-------------------+
                                      | 1
                                      |
                                      v 1
                            +-------------------+
                            |  Purchase Order   |
                            +-------------------+
                                      | 1
                                      |
                                      v *
                            +-------------------+
                            |  Production Job   |
                            +-------------------+
                                      | *
                                      |
                                      v 1
                            +-------------------+
                            |   Dispatch Slip   |
                            +-------------------+
                                      | *
                                      |
                                      v 1
                            +-------------------+
                            | WhatsApp Log Feed |
                            +-------------------+
```

1.  **Tenant**
    *   `id` (string, PK)
    *   `companyName` (string)
    *   `gstin` (string)
    *   `sandboxMode` (boolean)
2.  **Profile**
    *   `uid` (string, PK)
    *   `email` (string)
    *   `name` (string)
    *   `role` (enum: `sales`, `production`, `dispatch`, `management`)
    *   `tenantId` (string, FK)
3.  **RFQ**
    *   `id` (string, PK)
    *   `customerId` (string, FK)
    *   `customerName` (string)
    *   `phone` (string)
    *   `requirements` (string)
    *   `items` (array: `{ name: string, quantity: number }`)
    *   `status` (enum: `pending`, `quoted`, `declined`)
    *   `tenantId` (string, FK)
4.  **Quotation**
    *   `id` (string, PK)
    *   `rfqId` (string, FK)
    *   `quoteNumber` (string)
    *   `customerName` (string)
    *   `phone` (string)
    *   `items` (array: `{ name: string, quantity: number, unitPrice: number, total: number }`)
    *   `subtotal` (number)
    *   `gstAmount` (number)
    *   `total` (number)
    *   `status` (enum: `draft`, `sent`, `approved`, `declined`)
    *   `validUntil` (timestamp)
    *   `tenantId` (string, FK)
5.  **Purchase Order (Order)**
    *   `id` (string, PK)
    *   `quoteId` (string, FK)
    *   `orderNumber` (string)
    *   `customerName` (string)
    *   `phone` (string)
    *   `totalAmount` (number)
    *   `status` (enum: `confirmed`, `dispatched`, `completed`)
    *   `tenantId` (string, FK)
6.  **Production Job**
    *   `id` (string, PK)
    *   `orderId` (string, FK)
    *   `itemName` (string)
    *   `quantity` (number)
    *   `currentStage` (enum: `pattern_shop`, `molding`, `machining`, `quality_audit`, `ready`)
    *   `stagesHistory` (array: `{ stage: string, notes: string, updatedAt: timestamp, updatedBy: string }`)
    *   `tenantId` (string, FK)
7.  **Dispatch Slip (Dispatch)**
    *   `id` (string, PK)
    *   `orderId` (string, FK)
    *   `invoiceNumber` (string)
    *   `transporter` (string)
    *   `lrNumber` (string)
    *   `vehicleNumber` (string)
    *   `driverName` (string)
    *   `driverPhone` (string)
    *   `status` (enum: `shipped`, `delivered`)
    *   `items` (array: `{ name: string, quantity: number }`)
    *   `dispatchedAt` (timestamp)
    *   `tenantId` (string, FK)
8.  **WhatsApp Log**
    *   `id` (string, PK)
    *   `recipientPhone` (string)
    *   `recipientName` (string)
    *   `type` (string)
    *   `message` (string)
    *   `status` (enum: `delivered`, `pending`, `failed`)
    *   `timestamp` (timestamp)
    *   `tenantId` (string, FK)

---

## 7. Out of Scope Specs (Future Expansions)
To complete the pilot within target deadlines, the following capabilities are explicitly omitted from the MVP:
1.  **Inventory Stock Valuations**: Real-time batch-cost calculations of raw scrap alloys.
2.  **Purchase / Scrap Ingestion Module**: Ordering raw iron ore blocks or controlling vendor payments.
3.  **Automated Machine Integration**: Directly tapping PLCs on CNC machine beds to capture RPM counts or cycle runs.
4.  **Native Dealer App Console**: A custom portal for deep customer log-ins to generate catalogs. Instead, outbound notification triggers supply clean summary data on mobile links.
5.  **Filing Compliance Suite**: Automated generation of GSTR-1 filings. Ashrey FlowOps delivers clean tax calculations but defers financial accounting compliance reporting directly to standard Tally.erp software exports.
