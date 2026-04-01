import { db } from '@/lib/db'
import {
  helpdeskRmmAlerts, helpdeskRmmAgentMap, helpdeskTickets,
  helpdeskMessages, helpdeskClients,
} from '@/lib/schema'
import { eq, and, notInArray, sql } from 'drizzle-orm'
import { generateTicketNumber } from '@/lib/ticket-number'
import { triageRmmAlert } from '@/lib/ai/rmm-triage'
import { auditLog } from '@/lib/audit'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'

export interface RmmAlertPayload {
  alert_id: string
  agent_id: string
  hostname: string
  alert_type: string
  severity: string
  message: string
  raw?: Record<string, unknown>
}

export interface ProcessResult {
  alertId: string
  action: 'created' | 'grouped' | 'dismissed' | 'duplicate'
  ticketId?: string
  ticketNumber?: string
}

export async function processRmmAlert(alert: RmmAlertPayload): Promise<ProcessResult> {
  // 1. Dedup — skip if we already have this alert
  const existing = await db
    .select({ id: helpdeskRmmAlerts.id })
    .from(helpdeskRmmAlerts)
    .where(eq(helpdeskRmmAlerts.rmmAlertId, alert.alert_id))
    .limit(1)

  if (existing.length > 0) {
    return { alertId: alert.alert_id, action: 'duplicate' }
  }

  // 2. Look up client via agent map
  const agentMapping = await db
    .select()
    .from(helpdeskRmmAgentMap)
    .where(
      and(
        eq(helpdeskRmmAgentMap.rmmAgentId, alert.agent_id),
        eq(helpdeskRmmAgentMap.isActive, true),
      )
    )
    .limit(1)

  const clientId = agentMapping[0]?.clientId ?? null

  // Fetch client details for SLA + notification
  let client: { id: string; clientName: string; responseSlaMin: number; resolutionSlaDays: number } | null = null
  if (clientId) {
    const clients = await db
      .select({
        id: helpdeskClients.id,
        clientName: helpdeskClients.clientName,
        responseSlaMin: helpdeskClients.responseSlaMin,
        resolutionSlaDays: helpdeskClients.resolutionSlaDays,
      })
      .from(helpdeskClients)
      .where(eq(helpdeskClients.id, clientId))
      .limit(1)
    client = clients[0] ?? null
  }

  // 3. Find recent open RMM tickets for this machine (grouping window: 4 hours)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000)
  const openTickets = clientId
    ? await db
        .select({
          id: helpdeskTickets.id,
          subject: helpdeskTickets.subject,
          createdAt: helpdeskTickets.createdAt,
        })
        .from(helpdeskTickets)
        .where(
          and(
            eq(helpdeskTickets.clientId, clientId),
            eq(helpdeskTickets.source, 'rmm'),
            notInArray(helpdeskTickets.status, ['resolved', 'closed']),
            sql`${helpdeskTickets.createdAt} > ${fourHoursAgo}`,
          )
        )
    : []

  // 4. AI triage
  const triage = await triageRmmAlert({
    alertType: alert.alert_type,
    severity: alert.severity,
    message: alert.message,
    hostname: alert.hostname,
    agentId: alert.agent_id,
    openTickets: openTickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      createdAt: t.createdAt?.toISOString() ?? '',
    })),
  })

  // 5. Not actionable — dismiss
  if (!triage.actionable) {
    await db.insert(helpdeskRmmAlerts).values({
      rmmAlertId: alert.alert_id,
      rmmAgentId: alert.agent_id,
      hostname: alert.hostname,
      alertType: alert.alert_type,
      severity: alert.severity,
      rawPayload: alert.raw ?? null,
      dismissed: true,
    })

    await auditLog({
      entityType: 'rmm_alert',
      entityId: alert.alert_id,
      action: 'dismissed',
      userId: 'system',
      afterData: { reason: 'ai_noise_filter', summary: triage.summary },
    })

    return { alertId: alert.alert_id, action: 'dismissed' }
  }

  // 6. Group with existing ticket
  if (triage.groupWithTicketId) {
    const targetTicket = openTickets.find((t) => t.id === triage.groupWithTicketId)
    if (targetTicket) {
      await db.insert(helpdeskMessages).values({
        ticketId: targetTicket.id,
        content: `**RMM Alert (${alert.alert_type})** on ${alert.hostname}: ${alert.message}\n\nAI Summary: ${triage.summary}`,
        source: 'system',
        isInternal: false,
      })

      await db.insert(helpdeskRmmAlerts).values({
        rmmAlertId: alert.alert_id,
        rmmAgentId: alert.agent_id,
        hostname: alert.hostname,
        alertType: alert.alert_type,
        severity: alert.severity,
        rawPayload: alert.raw ?? null,
        ticketId: targetTicket.id,
      })

      await auditLog({
        entityType: 'rmm_alert',
        entityId: alert.alert_id,
        action: 'grouped',
        userId: 'system',
        afterData: { ticketId: targetTicket.id },
      })

      return { alertId: alert.alert_id, action: 'grouped', ticketId: targetTicket.id }
    }
  }

  // 7. Create new ticket
  const ticketNumber = await generateTicketNumber()
  const now = new Date()
  const slaResponseDue = client
    ? new Date(now.getTime() + client.responseSlaMin * 60 * 1000)
    : null
  const slaResolutionDue = client
    ? new Date(now.getTime() + client.resolutionSlaDays * 24 * 60 * 60 * 1000)
    : null

  const machineLabel = agentMapping[0]?.machineLabel
  const subject = machineLabel
    ? `${triage.summary} (${machineLabel})`
    : triage.summary

  const [ticket] = await db
    .insert(helpdeskTickets)
    .values({
      ticketNumber,
      subject,
      category: 'Endpoint Monitoring',
      priority: triage.priority,
      clientId,
      source: 'rmm',
      isInternal: false,
      isProactive: true,
      aiCategory: 'Endpoint Monitoring',
      aiPriority: triage.priority,
      aiSummary: triage.summary,
      aiConfidence: 80,
      slaResponseDue,
      slaResolutionDue,
      billable: false, // Proactive = non-billable per Section 8
    })
    .returning()

  await db.insert(helpdeskMessages).values({
    ticketId: ticket.id,
    content: `**RMM Alert** — ${alert.alert_type} (${alert.severity})\n**Machine:** ${alert.hostname}\n**Message:** ${alert.message}\n\nAI Summary: ${triage.summary}`,
    source: 'system',
    isInternal: false,
  })

  await db.insert(helpdeskRmmAlerts).values({
    rmmAlertId: alert.alert_id,
    rmmAgentId: alert.agent_id,
    hostname: alert.hostname,
    alertType: alert.alert_type,
    severity: alert.severity,
    rawPayload: alert.raw ?? null,
    ticketId: ticket.id,
  })

  await auditLog({
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'created',
    userId: 'system',
    afterData: { ticketNumber, source: 'rmm', isProactive: true, rmmAlertId: alert.alert_id },
  })

  // 8. Notify Erick for P1/P2 only
  if (triage.priority === 'critical' || triage.priority === 'high') {
    try {
      const resend = getResendClient()
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: 'erick@tronboll.us',
        subject: `[${ticketNumber}] RMM ${triage.priority.toUpperCase()} — ${triage.summary}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0d1117">
            <h2 style="color:#c2410c;margin:0 0 16px;font-size:1.1rem">RMM Alert → Helpdesk Ticket</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="color:#94a3b8;padding:4px 0;width:80px">Ticket</td><td style="color:#e2e8f0">${ticketNumber}</td></tr>
              <tr><td style="color:#94a3b8;padding:4px 0">Client</td><td style="color:#e2e8f0">${client?.clientName ?? 'Unmapped machine'}</td></tr>
              <tr><td style="color:#94a3b8;padding:4px 0">Machine</td><td style="color:#e2e8f0">${alert.hostname}${machineLabel ? ` (${machineLabel})` : ''}</td></tr>
              <tr><td style="color:#94a3b8;padding:4px 0">Alert</td><td style="color:#e2e8f0">${alert.alert_type} (${alert.severity})</td></tr>
              <tr><td style="color:#94a3b8;padding:4px 0">Priority</td><td style="color:#e2e8f0;font-weight:bold;color:${triage.priority === 'critical' ? '#ef4444' : '#f97316'}">${triage.priority}</td></tr>
              <tr><td style="color:#94a3b8;padding:4px 0;vertical-align:top">Summary</td><td style="color:#e2e8f0">${triage.summary}</td></tr>
            </table>
          </div>
        `,
      })
    } catch (e) {
      console.error('[rmm] Failed to notify admin:', e)
    }
  }

  return { alertId: alert.alert_id, action: 'created', ticketId: ticket.id, ticketNumber }
}
