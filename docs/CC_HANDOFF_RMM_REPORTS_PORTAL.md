# CC Handoff: RMM Integration, Proof-of-Value Reports & Client Portal

**Date:** 2026-04-01
**Author:** Claude Opus (BTS Project Chat)
**Target:** bts-helpdesk
**Priority:** After Sprint 1 stabilization — this is Sprint 2+
**Depends on:** Sprint 1 complete (schema, auth, internal ticketing, email gateway, Twilio bridge, AI triage — all live)

---

## Context

Read these files before starting:
1. `CLAUDE.md` — project conventions and architecture
2. `lib/schema.ts` — current 10-table Drizzle schema
3. `lib/ai/triage.ts` — existing AI triage engine
4. `app/api/email/inbound/route.ts` — email-to-ticket pattern
5. `app/api/twilio/inbound/route.ts` — voicemail-to-ticket pattern
6. This handoff document

### What Already Exists

Sprint 1 delivered:
- Full schema: clients, users (3-role), tickets, messages, time entries, KB, audit log
- AI triage via Claude Sonnet 4.6 (category, priority, summary, draft response, confidence)
- Email-to-ticket gateway (Resend inbound webhook, svix verification, reply threading)
- Twilio voicemail bridge (bts-site → helpdesk via internal secret)
- Internal dashboard with stats, ticket list, ticket detail with AI panel
- SLA tracking (response due, resolution due, breach flags)
- Time entry tracking per ticket
- Audit log on every state change

### Strategic Context

Kathy King signed the CBB MSP agreement on April 1, 2026. Effective April 4.
$295/mo ($199 base + 8 machines × $12). The agreement explicitly states:

- Section 8: Proactive Services do NOT consume Included Support Hours
- Section 8: Proactive activities are "logged and available to Client in monthly reports"
- SO 2.7: "Documentation is available to Client upon request"

These contract commitments drive the features in this handoff. The monthly
report isn't a nice-to-have — it's a deliverable Erick has already promised.

Kathy and Sylvana are Erick's gateway to other Borrego Springs clients.
Every feature here serves dual purpose: operational efficiency for Erick
AND visible proof-of-value that makes Kathy refer BTS to her network.

---

## PART A: RMM Integration — Automated Alert-to-Ticket Pipeline

### Overview

The RMM platform (Tactical RMM on Hetzner) generates alerts for: disk
health warnings, patch failures, high CPU/memory, AV detection events,
offline machines, and other system events. These alerts need to flow
into the helpdesk as auto-created tickets tagged as Proactive Services.

### Architecture

```
Tactical RMM (Hetzner)
    │
    ├── Option A: Webhook → POST /api/webhooks/rmm
    │   (Tactical RMM fires webhook on alert creation)
    │
    └── Option B: Cron → GET /api/cron/rmm-poll
        (Helpdesk polls Tactical RMM API every 15 min)

    ↓

/api/webhooks/rmm  OR  /api/cron/rmm-poll
    │
    ├── Deduplicate (check if alert already has a ticket)
    ├── Map RMM alert → helpdesk client (by machine hostname or agent ID)
    ├── AI Triage (Haiku — lightweight, fast, cheap)
    │   └── Is this noise or signal? What priority?
    │   └── Should this be grouped with an existing open ticket?
    ├── Create ticket with source='rmm', isProactive=true
    ├── Tag: proactive, system-initiated, rmm-alert
    └── Notify Erick only for P1/P2 (skip notification for routine P3/P4)
```

### Schema Additions

Add to `lib/schema.ts`:

```typescript
// ── RMM Alert Deduplication ─────────────────────────────────────────────────
// Prevents duplicate tickets from the same RMM alert

export const helpdeskRmmAlerts = pgTable('helpdesk_rmm_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  rmmAlertId: text('rmm_alert_id').notNull().unique(), // Tactical RMM alert ID
  rmmAgentId: text('rmm_agent_id'),                    // Machine agent ID
  hostname: text('hostname'),
  alertType: text('alert_type'),                        // disk_health | patch_fail | cpu_high | av_detect | offline | custom
  severity: text('severity'),                           // from RMM: info | warning | error | critical
  rawPayload: jsonb('raw_payload'),
  ticketId: uuid('ticket_id').references(() => helpdeskTickets.id),
  dismissed: boolean('dismissed').notNull().default(false), // tech can dismiss noise alerts
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

Add a field to `helpdeskTickets`:

```typescript
// Add to helpdeskTickets table definition:
isProactive: boolean('is_proactive').notNull().default(false),
```

This field is critical — it's the flag that separates "client-initiated"
from "system-initiated" for Section 8 compliance and report generation.

### New: RMM Agent-to-Client Mapping Table

```typescript
// Maps RMM agent IDs to helpdesk clients for automatic ticket routing
export const helpdeskRmmAgentMap = pgTable('helpdesk_rmm_agent_map', {
  id: uuid('id').primaryKey().defaultRandom(),
  rmmAgentId: text('rmm_agent_id').notNull().unique(),
  hostname: text('hostname').notNull(),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  machineLabel: text('machine_label'),  // "Kathy's desk", "Front reception"
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

Populate this during Friday's onboarding: as you install RMM on each CBB
machine, record the agent ID and hostname, then seed this table so alerts
auto-route to the CBB client record.

### API Routes

#### `/api/webhooks/rmm/route.ts` — Webhook Receiver (Option A)

```typescript
// Auth: Validate shared secret from Tactical RMM webhook config
// 1. Parse alert payload (alert_id, agent_id, hostname, type, severity, message)
// 2. Check helpdeskRmmAlerts for duplicate (by rmmAlertId) — skip if exists
// 3. Look up client via helpdeskRmmAgentMap (by rmmAgentId or hostname)
// 4. AI triage with Haiku (fast, cheap):
//    - Is this noise? (routine patch success, info-level disk check) → dismiss
//    - Should this group with an existing open ticket for same machine? → append message
//    - New issue? → create ticket
// 5. Create ticket: source='rmm', isProactive=true, isInternal=false
// 6. Create rmmAlerts record linking alert to ticket
// 7. Notify Erick only for P1/P2 via email (skip P3/P4 — he'll see them in dashboard)
// 8. Audit log: action='rmm_alert_received'
```

#### `/api/cron/rmm-poll/route.ts` — Polling Fallback (Option B)

```typescript
// Runs every 15 min via Vercel Cron
// 1. verifyCronAuth(req) — standard BTS cron pattern
// 2. Call Tactical RMM API: GET /alerts/?pending=true
// 3. For each alert not already in helpdeskRmmAlerts:
//    - Same flow as webhook handler above
// 4. Mark alerts as processed in RMM (if API supports it)
// 5. Return { checked: N, created: N, dismissed: N, grouped: N }
```

**Which to implement:** Start with Option A (webhook) if Tactical RMM
supports webhooks natively. Fall back to Option B (polling) if not.
Both can coexist — webhook for real-time, polling as a safety net.

### AI Triage for RMM Alerts

Create `lib/ai/rmm-triage.ts`:

```typescript
// Uses Haiku (not Sonnet) — these are high-volume, low-complexity decisions
// System prompt:
// "You are an RMM alert triage agent for an MSP. Analyze this system alert
//  and determine: (1) Is this actionable or noise? (2) Priority level.
//  (3) Should it be grouped with an existing open ticket for this machine?
//  (4) One-sentence summary for the ticket.
//  Return JSON: { actionable: boolean, priority, summary, groupWithTicketId? }"
//
// Input: alert type, severity, message, hostname, recent open tickets for this machine
// Output: actionable flag, priority, summary, optional grouping recommendation
```

### Alert Grouping Logic

Critical for preventing ticket spam. If machine X has an open ticket for
"High CPU" and a new alert fires for "High Memory" on the same machine
within 4 hours, the AI should recommend grouping them. The system appends
a message to the existing ticket rather than creating a new one.

Query: "SELECT * FROM helpdesk_tickets WHERE clientId = ? AND status NOT IN
('resolved','closed') AND source = 'rmm' AND createdAt > NOW() - INTERVAL '4 hours'"

If the AI says group → append message to existing ticket.
If the AI says new issue → create new ticket.

### Environment Variables (New)

```
TACTICAL_RMM_URL=https://rmm.tronboll.us    # or wherever it's hosted
TACTICAL_RMM_API_KEY=<api key>
RMM_WEBHOOK_SECRET=<shared secret for webhook auth>
```

---

## PART B: Automated Proof-of-Value Reports

### Overview

Four report types, all generated by AI from ticket data, all stored as
PDFs in Vercel Blob, all available in the client portal and sent via email.

| Report | Frequency | Generated On | Covers |
|--------|-----------|-------------|--------|
| Monthly Service Summary | Monthly | 5th of each month | 5th of prev month → 4th of current month |
| Quarterly Priority Report | Quarterly | 5th of Jan/Apr/Jul/Oct | Previous 3 months |
| Semi-Annual Savings Analysis | Every 6 months | 5th of Jan/Jul | Previous 6 months |
| Annual Review | Annual | January 5th | Previous 12 months |

### Schema Additions

```typescript
// ── Client Reports ──────────────────────────────────────────────────────────

export const helpdeskReports = pgTable('helpdesk_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  reportType: text('report_type').notNull(),
  // 'monthly_summary' | 'quarterly_priority' | 'semi_annual_savings' | 'annual_review'
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  periodLabel: text('period_label').notNull(),  // "April 2026", "Q2 2026", "H1 2026"
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  pdfUrl: text('pdf_url'),                      // Vercel Blob URL
  reportData: jsonb('report_data'),             // structured data before PDF render
  status: text('status').notNull().default('draft'),
  // 'draft' | 'approved' | 'sent'
  sentAt: timestamp('sent_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),              // tech/admin who approved
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
```

### Report Generation Cron

Create `/api/cron/generate-reports/route.ts`:

```typescript
// Runs on the 5th of every month at 6 AM PT
// 1. verifyCronAuth(req)
// 2. For each active client in helpdeskClients:
//    a. Always generate monthly_summary (prev month's billing period)
//    b. If month is Jan/Apr/Jul/Oct → also generate quarterly_priority
//    c. If month is Jan/Jul → also generate semi_annual_savings
//    d. If month is Jan → also generate annual_review
// 3. For each report:
//    a. Query ticket data for the period
//    b. Build structured reportData (see below)
//    c. Send reportData to Claude Sonnet for narrative generation
//    d. Generate PDF with reportlab or @react-pdf/renderer
//    e. Upload PDF to Vercel Blob
//    f. Create helpdeskReports record with status='draft'
// 4. Notify Erick: "X reports generated for Y clients. Review and approve."
```

### Vercel Cron

Add to `vercel.json`:

```json
{
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/rmm-poll",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/generate-reports",
      "schedule": "0 14 5 * *"
    }
  ]
}
```

(14:00 UTC = 6:00 AM PT on the 5th)

### Report Data Queries

Create `lib/reports/data.ts`:

```typescript
// Shared query builder for all report types

interface ReportData {
  client: { name: string; slaTier: string }
  period: { start: Date; end: Date; label: string }

  // Ticket counts
  totalTickets: number
  byPriority: { critical: number; high: number; normal: number; low: number }
  byCategory: Record<string, number>
  bySource: { email: number; phone: number; portal: number; rmm: number; internal: number }
  byStatus: Record<string, number>

  // Proactive vs client-initiated
  proactiveTickets: number    // isProactive = true
  clientInitiated: number     // isProactive = false, isInternal = false
  internalOnly: number        // isInternal = true

  // SLA performance
  slaResponseMet: number
  slaResponseBreached: number
  slaResolutionMet: number
  slaResolutionBreached: number
  avgResponseMinutes: number
  avgResolutionHours: number

  // Time tracking
  totalMinutesLogged: number
  billableMinutes: number
  nonBillableMinutes: number  // proactive services
  includedHoursUsed: number   // of the 2hr/mo allowance
  includedHoursRemaining: number

  // Top issues (for narrative)
  topCategories: { category: string; count: number }[]
  notableTickets: { ticketNumber: string; subject: string; priority: string; summary: string }[]

  // For savings analysis only
  hypotheticalBreakFixCost?: number  // what this would have cost at $95/hr
  actualMspCost?: number             // what they paid under MSP
  estimatedSavings?: number
}
```

### AI Report Generation

Create `lib/ai/report-writer.ts`:

#### Monthly Service Summary Prompt

```
You are writing a monthly IT management report for {clientName}, a
non-technical business owner. This report covers {periodLabel}.

DATA:
{JSON.stringify(reportData)}

Write a professional but warm one-page summary that demonstrates
the value of proactive IT management. Structure as:

1. HEADLINE — One sentence capturing the month. Example: "A clean month
   with zero downtime and 23 maintenance tasks handled before you
   noticed them."

2. BY THE NUMBERS — 3-4 key stats in plain language. Not a data dump.
   Example: "We resolved 7 support requests, ran 23 automated
   maintenance tasks, and kept all 8 machines patched and monitored."

3. WHAT WE PREVENTED — Any proactive catches (disk warnings, patch
   failures, security events). Frame as problems avoided, not
   technical jargon. "We caught a failing disk on Robin's workstation
   before it caused data loss."

4. WHAT WE RESOLVED — Notable client-initiated tickets, briefly.
   "Kerry reported a printer issue Tuesday morning; it was fixed
   by lunch."

5. YOUR SLA PERFORMANCE — Response and resolution stats. Keep it
   simple: "Every request was acknowledged within 2 hours and
   resolved within our committed timeframe."

6. LOOKING AHEAD — Anything upcoming (patches, recommendations).

TONE: Professional, warm, zero jargon. The reader should finish
thinking "I'm glad someone is handling this so I don't have to."

Do NOT fabricate events. Only reference tickets in the data.
Return plain text formatted with clear section headers.
```

#### Quarterly Priority Report Prompt

```
You are writing a quarterly IT service report for {clientName}.
Period: {periodLabel}.

DATA:
{JSON.stringify(reportData)}

Create a brief 1-2 page report listing services rendered by Priority:

P1 (Critical): [count] incidents — [brief description of each, or
"0 incidents — this is what proactive management looks like"]

P2 (High): [count] — [brief descriptions]

P3 (Medium): [count] — [brief descriptions]

P4 (Low): [count] — [brief descriptions]

Proactive (System-Initiated): [count] automated maintenance events

End with a one-paragraph summary. Clean, scannable, professional.
```

#### Semi-Annual Savings Analysis Prompt

```
You are writing a semi-annual cost analysis for {clientName}.
Period: {periodLabel}.

DATA:
{JSON.stringify(reportData)}

Calculate and present what the IT services rendered during this
period would have cost under a break-fix model (ad-hoc billing
at $95/hr standard rate with $250 emergency arrival fee) versus
what the client actually paid under the MSP agreement.

For each notable service event, estimate the break-fix cost:
- Proactive maintenance tasks: "Would have been discovered as
  a failure, requiring emergency response: 2hr on-site × $95 = $190
  + $250 arrival = $440"
- Remote support: "At standard rate: X hours × $95 = $Y"
- P1 incidents: "Emergency response: $250 arrival + X hours × $125 = $Y"

Present a clear comparison table:
- Total services rendered under MSP
- Equivalent break-fix cost
- MSP cost for the period
- Client savings

TONE: Factual, not salesy. Let the numbers speak. Do NOT inflate
estimates — conservative is more credible. Round to nearest $25.
```

### PDF Generation

Create `lib/reports/pdf.ts`:

Use `@react-pdf/renderer` (already available in the ecosystem) or
`reportlab` via a serverless Python function. The PDF should include:

- BTS branded header (logo, "Backcountry Tech Solutions", burnt orange accent)
- Client name and period in subheader
- AI-generated narrative content
- For quarterly/savings reports: data tables
- Page numbers in footer
- "Confidential — prepared for {clientName}" in footer

Store generated PDFs in Vercel Blob under:
`reports/{clientId}/{reportType}/{periodLabel}.pdf`

### Report Review Workflow

Reports generate in `draft` status. Erick sees them in a new
"Reports" section on the internal dashboard.

#### `/app/(internal)/reports/page.tsx` — Report Queue

- Stats: Pending review, Sent this month, Total generated
- Filter by client, report type, status
- Table: Client | Type | Period | Status | Generated | Actions
- Actions: [View PDF] [Approve & Send] [Edit Notes] [Delete]

#### `/app/(internal)/reports/[id]/page.tsx` — Report Detail

- PDF preview (embedded or link)
- AI-generated narrative displayed as text (editable before approval)
- "Regenerate" button (re-runs the AI with the same data)
- "Approve & Send" → changes status to 'sent', emails PDF to client
- Notes field for Erick's adjustments

### Report Sending

#### `/api/reports/[id]/send/route.ts`

```typescript
// 1. Verify admin session
// 2. Fetch report record + client info
// 3. Send email via Resend:
//    From: reports@tronboll.us (or helpdesk@tronboll.us)
//    To: client's primary email
//    Subject: "BTS IT Management Report — {periodLabel}"
//    Body: Brief intro + "Your report is attached and also
//          available in your client portal."
//    Attachment: PDF from Vercel Blob
// 4. Update report status to 'sent', set sentAt
// 5. Audit log: action='report_sent'
```

### API Routes Summary (Part B)

```
/api/cron/generate-reports/route.ts     — monthly cron, generates all due reports
/api/reports/route.ts                   — GET list, POST manual generation
/api/reports/[id]/route.ts              — GET detail, PUT update notes/narrative
/api/reports/[id]/send/route.ts         — POST approve & send
/api/reports/[id]/regenerate/route.ts   — POST re-run AI generation
```

---

## PART C: Client Portal

### Overview

Sprint 2 of the original helpdesk spec. The portal lives at
`/portal` and uses magic-link authentication (pattern already exists
in `portal/login`). Client users see only their own data, never
internal tickets or notes.

### Portal Pages

#### `/portal/page.tsx` — Portal Dashboard

After magic-link login, client sees:
- Welcome: "Coldwell Banker Borrego — IT Support Portal"
- Active Tickets card (count + list of open tickets)
- Quick action: "Submit New Request" button
- Latest Report card (most recent monthly summary, download link)
- Contact card: helpdesk@tronboll.us, (760) 782-8476

#### `/portal/tickets/page.tsx` — My Tickets

- List of all tickets for this client (NOT internal tickets)
- Filter: Open | Resolved | All
- Each row: ticket number, subject, priority badge, status badge, date
- Click → ticket detail

#### `/portal/tickets/[id]/page.tsx` — Ticket Detail

- Thread view of all NON-INTERNAL messages
- Reply form (creates message with source='portal', isInternal=false)
- Sidebar: status, priority, SLA status, created date
- NO access to: internal notes, AI triage panel, assignment, time entries

#### `/portal/tickets/new/page.tsx` — Submit New Request

- Simple form: Subject, Description, Priority (optional — defaults to normal)
- Category auto-assigned by AI after submission
- On submit: creates ticket, triggers AI triage, sends confirmation email
- Redirects to the new ticket detail page

#### `/portal/reports/page.tsx` — My Reports

- List of all sent reports for this client
- Download PDF links
- Report type badge, period label, sent date
- Most recent report highlighted at top

#### `/portal/assets/page.tsx` — My Environment

Read-only view of the client's managed environment. Data sourced from
either bts-brain Site Profile (via API) or a synced snapshot in the
helpdesk DB. Shows:

- **Covered Machines** — hostname, type, OS, location (from Exhibit A)
- **Network Infrastructure** — device, type, role (from Exhibit A-2)
- **Third-Party Services** — service, vendor, BTS role (from Exhibit B)
- **Support Contacts** — registered employees (from Exhibit D)

NO credentials, NO IPs, NO internal notes exposed. This is purely
"here's what we manage for you" visibility.

Implementation options (CC decides):
- Option A: Query bts-brain API directly (requires cross-service auth)
- Option B: Sync a snapshot into helpdesk DB (simpler, decoupled)
- Option C: Store asset data directly on helpdeskClients as JSON fields

Recommend Option B — a nightly cron that pulls the client's device list
from bts-brain and stores it as a JSON snapshot on the client record.
Decoupled, no cross-service auth complexity.

#### `/portal/kb/page.tsx` — Knowledge Base

- Published KB articles (isPublished=true) filtered to:
  - Global articles (clientId=null) — available to all clients
  - Client-specific articles (clientId matches) — only their guides
- Search by keyword
- Article detail with helpful/not-helpful feedback buttons

### Portal API Routes

All portal API routes MUST enforce:
- Magic-link session authentication (role='client')
- Client scoping: every query includes `WHERE clientId = session.clientId`
- Internal content filtered: `WHERE isInternal = false`
- No access to: time entries, AI triage data, assignment info, audit logs

```
/api/portal/auth/magic-link/route.ts    — request magic link
/api/portal/auth/verify/route.ts        — verify token, create session
/api/portal/tickets/route.ts            — GET my tickets, POST new ticket
/api/portal/tickets/[id]/route.ts       — GET ticket detail (filtered)
/api/portal/tickets/[id]/messages/route.ts — GET messages (non-internal), POST reply
/api/portal/reports/route.ts            — GET my reports (sent only)
/api/portal/assets/route.ts             — GET my environment snapshot
/api/portal/kb/route.ts                 — GET published articles
/api/portal/kb/[slug]/route.ts          — GET article detail
/api/portal/kb/[id]/feedback/route.ts   — POST helpful/not-helpful
```

### Portal Security Rules (CRITICAL)

These are non-negotiable. Reference CLAUDE.md "Key Rules":

1. **Client registration is manual** — no self-registration on the portal.
   Erick creates portal users via the internal admin UI.
2. **Internal content NEVER leaks** — every query that returns tickets or
   messages MUST filter `isInternal = false`. No exceptions.
3. **AI data hidden** — aiCategory, aiPriority, aiSummary, aiDraftResponse,
   aiConfidence are NEVER returned by portal API endpoints.
4. **Client can only see their own data** — every query scoped by clientId
   from the session. Cross-client access is a critical security violation.
5. **Time entries hidden** — billable/non-billable hours are internal data.
6. **Audit log inaccessible** — portal users cannot see the audit trail.

---

## Execution Order

### Phase H2a — RMM Integration (do first — enables all reporting)

1. ⬜ Add `isProactive` field to helpdeskTickets
2. ⬜ Add `helpdeskRmmAlerts` table
3. ⬜ Add `helpdeskRmmAgentMap` table
4. ⬜ Run Drizzle migration
5. ⬜ Create `lib/ai/rmm-triage.ts` (Haiku-based alert triage)
6. ⬜ Create `/api/webhooks/rmm/route.ts` (webhook receiver)
7. ⬜ Create `/api/cron/rmm-poll/route.ts` (polling fallback)
8. ⬜ Add RMM agent map admin page: `/app/(internal)/rmm/page.tsx`
   (CRUD for agent-to-client mappings — populate after Friday's onboarding)
9. ⬜ Add cron to `vercel.json`
10. ⬜ Test: manually fire a test alert, verify ticket creation and triage

### Phase H2b — Report Engine (do second — builds on ticket data)

11. ⬜ Add `helpdeskReports` table + migration
12. ⬜ Create `lib/reports/data.ts` (query builders for report data)
13. ⬜ Create `lib/ai/report-writer.ts` (AI prompts for 4 report types)
14. ⬜ Create `lib/reports/pdf.ts` (PDF generation with BTS branding)
15. ⬜ Create `/api/cron/generate-reports/route.ts`
16. ⬜ Create `/api/reports/route.ts` (list + manual generate)
17. ⬜ Create `/api/reports/[id]/route.ts` (detail + update)
18. ⬜ Create `/api/reports/[id]/send/route.ts` (approve + email)
19. ⬜ Create `/api/reports/[id]/regenerate/route.ts`
20. ⬜ Build `/app/(internal)/reports/page.tsx` (report queue)
21. ⬜ Build `/app/(internal)/reports/[id]/page.tsx` (report detail + review)
22. ⬜ Add report cron to `vercel.json`
23. ⬜ Test: manually generate a monthly report for CBB, review PDF output

### Phase H2c — Client Portal (do third — presents everything to clients)

24. ⬜ Build portal auth: magic-link request + verify + session
25. ⬜ Build `/portal/page.tsx` (dashboard)
26. ⬜ Build `/portal/tickets/page.tsx` (my tickets)
27. ⬜ Build `/portal/tickets/[id]/page.tsx` (ticket detail, filtered)
28. ⬜ Build `/portal/tickets/new/page.tsx` (submit request)
29. ⬜ Build `/portal/reports/page.tsx` (my reports)
30. ⬜ Build `/portal/assets/page.tsx` (my environment)
31. ⬜ Build `/portal/kb/page.tsx` + `/portal/kb/[slug]/page.tsx`
32. ⬜ Build all portal API routes (see list above)
33. ⬜ Security audit: verify all portal queries filter isInternal,
     scope by clientId, hide AI data and time entries
34. ⬜ Create portal user for Kathy King (manual, via admin UI)
35. ⬜ Test: log in as Kathy, verify she sees only CBB data

### Phase H2d — KB Management (Sprint 2 completion)

36. ⬜ Build `/app/(internal)/kb/page.tsx` (article list + CRUD)
37. ⬜ Build `/app/(internal)/kb/[id]/page.tsx` (article editor)
38. ⬜ Build "Generate KB Article" button on resolved ticket detail page
39. ⬜ AI: generate KB draft from ticket thread (Claude Sonnet)
40. ⬜ Test: resolve a ticket, generate KB article, verify it appears in portal

---

## Files to Create

```
lib/schema.ts                                  — AMEND (add isProactive, rmmAlerts, rmmAgentMap, reports)
drizzle/                                       — new migration
lib/ai/rmm-triage.ts                           — Haiku-based RMM alert triage
lib/ai/report-writer.ts                        — Sonnet prompts for 4 report types
lib/reports/data.ts                            — query builders for report data
lib/reports/pdf.ts                             — PDF generation with BTS branding
app/api/webhooks/rmm/route.ts                  — RMM webhook receiver
app/api/cron/rmm-poll/route.ts                 — RMM polling fallback
app/api/cron/generate-reports/route.ts         — monthly report generation
app/api/reports/route.ts                       — report list + manual generate
app/api/reports/[id]/route.ts                  — report detail + update
app/api/reports/[id]/send/route.ts             — approve & send
app/api/reports/[id]/regenerate/route.ts       — re-run AI
app/(internal)/reports/page.tsx                — report review queue
app/(internal)/reports/[id]/page.tsx           — report detail + review
app/(internal)/rmm/page.tsx                    — RMM agent mapping admin
app/portal/page.tsx                            — portal dashboard
app/portal/tickets/page.tsx                    — my tickets
app/portal/tickets/[id]/page.tsx               — ticket detail (filtered)
app/portal/tickets/new/page.tsx                — submit request
app/portal/reports/page.tsx                    — my reports
app/portal/assets/page.tsx                     — my environment
app/portal/kb/page.tsx                         — knowledge base
app/portal/kb/[slug]/page.tsx                  — article detail
app/api/portal/auth/magic-link/route.ts        — magic link request
app/api/portal/auth/verify/route.ts            — token verification
app/api/portal/tickets/route.ts                — client ticket list + create
app/api/portal/tickets/[id]/route.ts           — client ticket detail
app/api/portal/tickets/[id]/messages/route.ts  — client messages + reply
app/api/portal/reports/route.ts                — client reports
app/api/portal/assets/route.ts                 — client environment
app/api/portal/kb/route.ts                     — published KB articles
app/api/portal/kb/[slug]/route.ts              — article detail
app/api/portal/kb/[id]/feedback/route.ts       — helpful/not-helpful
app/(internal)/kb/page.tsx                     — KB management
app/(internal)/kb/[id]/page.tsx                — KB article editor
vercel.json                                    — AMEND (add crons)
```

---

## Important Notes

1. **RMM integration comes first** because the report engine depends on
   having proactive tickets in the system. Without RMM → helpdesk flow,
   the monthly reports will only show client-initiated tickets and miss
   the biggest proof-of-value: "23 maintenance tasks handled before you
   noticed them."

2. **Reports generate in draft status, always.** Erick reviews before
   sending. The AI can hallucinate a disk failure that never happened —
   human review catches this. This is the same pattern as the AI triage
   draft response: AI generates, human approves.

3. **The savings analysis must be conservative.** If the AI inflates
   break-fix estimates, Kathy will notice and trust erodes. Better to
   underestimate savings and let her draw her own conclusions than to
   oversell. The prompt explicitly says "round to nearest $25" and
   "conservative is more credible."

4. **Portal security is non-negotiable.** The six rules in the Portal
   Security section are hard requirements. Every portal API route gets
   a security audit before deployment. Internal data leaking to a client
   would be a professional catastrophe.

5. **Kathy and Sylvana are the gateway.** Every feature here should be
   evaluated through the lens of: "Would this make Kathy show someone
   else?" The monthly PDF report is the artifact. The client portal is
   the experience. The savings analysis is the conversation starter.
   When Kathy's friend asks "who does your IT?", these are the things
   Kathy points to.

6. **Env vars needed (Erick provides):**
   - `TACTICAL_RMM_URL` — RMM server URL
   - `TACTICAL_RMM_API_KEY` — RMM API key
   - `RMM_WEBHOOK_SECRET` — shared secret for webhook auth
   - All other env vars already exist from Sprint 1

7. **Asset data for the portal** comes from bts-brain Site Profiles.
   The simplest approach is a JSON snapshot on the client record, synced
   nightly. Do NOT build cross-service API auth for this — it's
   overengineering. A cron that reads from bts-brain's Neon DB directly
   (both are Neon, both are on the same Vercel team) is fine for now.
