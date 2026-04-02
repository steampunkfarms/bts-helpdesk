import {
  pgTable, text, boolean, timestamp, integer, uuid, serial, jsonb,
} from 'drizzle-orm/pg-core'

// ── Helpdesk Clients ────────────────────────────────────────────────────────
// Registered MSP clients. Every ticket is scoped to a client.

export const helpdeskClients = pgTable('helpdesk_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientName: text('client_name').notNull(),
  primaryEmail: text('primary_email').notNull(),
  phone: text('phone'),
  siteAddress: text('site_address'),
  slaTier: text('sla_tier').notNull().default('standard'), // priority | standard | basic
  responseSlaMin: integer('response_sla_min').notNull().default(480), // minutes to first response
  resolutionSlaDays: integer('resolution_sla_days').notNull().default(3),
  notifyWebhook: text('notify_webhook'),
  btsBrainOrgId: text('bts_brain_org_id'),
  btsSiteClientId: text('bts_site_client_id'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Client Registered Emails ────────────────────────────────────────────────
// Multiple emails per client for inbound matching.

export const helpdeskClientEmails = pgTable('helpdesk_client_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  email: text('email').notNull().unique(), // lowercase, trimmed
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Helpdesk Users ──────────────────────────────────────────────────────────
// Three roles: client, tech, admin. Clients registered manually by admin.

export const helpdeskUsers = pgTable('helpdesk_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('client'), // client | tech | admin
  passwordHash: text('password_hash'), // null for client-only users
  clientId: uuid('client_id').references(() => helpdeskClients.id),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Magic Link Tokens ───────────────────────────────────────────────────────

export const helpdeskTokens = pgTable('helpdesk_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => helpdeskUsers.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Tickets ─────────────────────────────────────────────────────────────────

export const helpdeskTickets = pgTable('helpdesk_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketNumber: text('ticket_number').notNull().unique(), // BTS-YYYYMMDD-NNN
  clientId: uuid('client_id').references(() => helpdeskClients.id), // null for internal-only
  createdByUserId: uuid('created_by_user_id').references(() => helpdeskUsers.id),
  assignedToUserId: uuid('assigned_to_user_id').references(() => helpdeskUsers.id),

  subject: text('subject').notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull().default('normal'), // critical | high | normal | low
  status: text('status').notNull().default('open'), // open | awaiting_client | awaiting_tech | in_progress | resolved | closed

  isInternal: boolean('is_internal').notNull().default(false),
  isProactive: boolean('is_proactive').notNull().default(false),
  source: text('source').notNull().default('portal'), // email | portal | phone | internal | rmm

  // AI Triage
  aiCategory: text('ai_category'),
  aiPriority: text('ai_priority'),
  aiSummary: text('ai_summary'),
  aiDraftResponse: text('ai_draft_response'),
  aiConfidence: integer('ai_confidence'),

  // SLA Tracking
  slaResponseDue: timestamp('sla_response_due', { withTimezone: true }),
  slaResolutionDue: timestamp('sla_resolution_due', { withTimezone: true }),
  firstRespondedAt: timestamp('first_responded_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  slaResponseBreached: boolean('sla_response_breached').notNull().default(false),
  slaResolutionBreached: boolean('sla_resolution_breached').notNull().default(false),

  // Time Tracking
  totalMinutes: integer('total_minutes').notNull().default(0),
  billable: boolean('billable').notNull().default(true),

  // Resolution tracking
  resolvedBy: text('resolved_by'), // chatbot | tech | client | null

  // Chatbot
  chatbotSessionId: text('chatbot_session_id'),

  // Email Threading
  inboundEmailId: text('inbound_email_id'),
  lastMessageId: text('last_message_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Ticket Messages ─────────────────────────────────────────────────────────

export const helpdeskMessages = pgTable('helpdesk_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => helpdeskTickets.id),
  authorUserId: uuid('author_user_id').references(() => helpdeskUsers.id),

  content: text('content').notNull(),
  contentHtml: text('content_html'),
  isInternal: boolean('is_internal').notNull().default(false),
  source: text('source').notNull().default('portal'), // email | portal | phone | system | ai_draft

  attachments: jsonb('attachments').default('[]'), // [{name, url, mimeType, sizeBytes}]

  // Email metadata
  emailFrom: text('email_from'),
  emailMessageId: text('email_message_id'),

  // Phone metadata
  callSid: text('call_sid'),
  recordingUrl: text('recording_url'),
  transcription: text('transcription'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Time Entries ────────────────────────────────────────────────────────────

export const helpdeskTimeEntries = pgTable('helpdesk_time_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => helpdeskTickets.id),
  userId: uuid('user_id').notNull().references(() => helpdeskUsers.id),
  minutes: integer('minutes').notNull(),
  description: text('description'),
  billable: boolean('billable').notNull().default(true),
  loggedAt: timestamp('logged_at', { withTimezone: true }).defaultNow(),
})

// ── Knowledge Base ──────────────────────────────────────────────────────────

export const helpdeskKbArticles = pgTable('helpdesk_kb_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  category: text('category'),
  clientId: uuid('client_id').references(() => helpdeskClients.id), // null = global
  isPublished: boolean('is_published').notNull().default(false),
  sourceTicketId: uuid('source_ticket_id').references(() => helpdeskTickets.id),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => helpdeskUsers.id),
  updatedByUserId: uuid('updated_by_user_id').references(() => helpdeskUsers.id),
  tags: text('tags').array().default([]),
  viewCount: integer('view_count').notNull().default(0),
  helpfulCount: integer('helpful_count').notNull().default(0),
  embedding: text('embedding'), // nullable — prep for future pgvector migration
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── RMM Alert Deduplication ─────────────────────────────────────────────────
// Prevents duplicate tickets from the same RMM alert.

export const helpdeskRmmAlerts = pgTable('helpdesk_rmm_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  rmmAlertId: text('rmm_alert_id').notNull().unique(),
  rmmAgentId: text('rmm_agent_id'),
  hostname: text('hostname'),
  alertType: text('alert_type'), // disk_health | patch_fail | cpu_high | av_detect | offline | custom
  severity: text('severity'), // info | warning | error | critical
  rawPayload: jsonb('raw_payload'),
  ticketId: uuid('ticket_id').references(() => helpdeskTickets.id),
  dismissed: boolean('dismissed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── RMM Agent-to-Client Mapping ────────────────────────────────────────────
// Maps RMM agent IDs to helpdesk clients for automatic ticket routing.

export const helpdeskRmmAgentMap = pgTable('helpdesk_rmm_agent_map', {
  id: uuid('id').primaryKey().defaultRandom(),
  rmmAgentId: text('rmm_agent_id').notNull().unique(),
  hostname: text('hostname').notNull(),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  machineLabel: text('machine_label'), // "Kathy's desk", "Front reception"
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Client Reports ─────────────────────────────────────────────────────────
// AI-generated proof-of-value reports stored as PDFs in Vercel Blob.

export const helpdeskReports = pgTable('helpdesk_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  reportType: text('report_type').notNull(), // monthly_summary | quarterly_priority | semi_annual_savings | annual_review
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  periodLabel: text('period_label').notNull(), // "April 2026", "Q2 2026", "H1 2026"
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  pdfUrl: text('pdf_url'),
  reportData: jsonb('report_data'),
  status: text('status').notNull().default('draft'), // draft | approved | sent
  sentAt: timestamp('sent_at', { withTimezone: true }),
  reviewedBy: text('reviewed_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Chatbot Sessions ───────────────────────────────────────────────────────
// Stores chatbot conversation transcripts and metrics per session.

export const helpdeskChatbotSessions = pgTable('helpdesk_chatbot_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => helpdeskTickets.id),
  userId: uuid('user_id').notNull().references(() => helpdeskUsers.id),
  clientId: uuid('client_id').notNull().references(() => helpdeskClients.id),
  messages: jsonb('messages').notNull().default('[]'),
  // [{ role: 'user'|'assistant', content: string, timestamp: ISO, kbArticleIds?: string[], feedback?: 'up'|'down' }]
  kbArticlesCited: text('kb_articles_cited').array().default([]),
  wasEscalated: boolean('was_escalated').notNull().default(false),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  feedbackRating: integer('feedback_rating'), // 1-5 per-session
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Audit Log ───────────────────────────────────────────────────────────────
// Immutable. Every ticket state change, assignment, SLA breach logged.

export const helpdeskAuditLog = pgTable('helpdesk_audit_log', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(), // ticket | message | kb_article | user
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(), // created | status_changed | assigned | sla_breached | etc.
  userId: text('user_id'), // email or 'system' or 'ai'
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
