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
  source: text('source').notNull().default('portal'), // email | portal | phone | internal

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
