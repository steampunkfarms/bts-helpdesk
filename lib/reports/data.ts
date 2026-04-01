import { db } from '@/lib/db'
import {
  helpdeskTickets, helpdeskTimeEntries, helpdeskClients,
} from '@/lib/schema'
import { eq, and, gte, lt, sql } from 'drizzle-orm'

export interface ReportData {
  client: { name: string; slaTier: string }
  period: { start: Date; end: Date; label: string }

  totalTickets: number
  byPriority: { critical: number; high: number; normal: number; low: number }
  byCategory: Record<string, number>
  bySource: { email: number; phone: number; portal: number; rmm: number; internal: number }
  byStatus: Record<string, number>

  proactiveTickets: number
  clientInitiated: number
  internalOnly: number

  slaResponseMet: number
  slaResponseBreached: number
  slaResolutionMet: number
  slaResolutionBreached: number
  avgResponseMinutes: number
  avgResolutionHours: number

  totalMinutesLogged: number
  billableMinutes: number
  nonBillableMinutes: number
  includedHoursUsed: number
  includedHoursRemaining: number

  topCategories: { category: string; count: number }[]
  notableTickets: { ticketNumber: string; subject: string; priority: string; summary: string }[]

  hypotheticalBreakFixCost?: number
  actualMspCost?: number
  estimatedSavings?: number
}

export async function buildReportData(params: {
  clientId: string
  periodStart: Date
  periodEnd: Date
  periodLabel: string
  mspMonthlyCost?: number
}): Promise<ReportData> {
  const { clientId, periodStart, periodEnd, periodLabel } = params

  // Fetch client
  const clients = await db
    .select({ clientName: helpdeskClients.clientName, slaTier: helpdeskClients.slaTier })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, clientId))
    .limit(1)
  const client = clients[0] ?? { clientName: 'Unknown', slaTier: 'standard' }

  // Fetch all tickets in period
  const tickets = await db
    .select()
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.clientId, clientId),
        gte(helpdeskTickets.createdAt, periodStart),
        lt(helpdeskTickets.createdAt, periodEnd),
      )
    )

  // Fetch time entries for these tickets
  const ticketIds = tickets.map((t) => t.id)
  const timeEntries = ticketIds.length > 0
    ? await db
        .select()
        .from(helpdeskTimeEntries)
        .where(
          and(
            sql`${helpdeskTimeEntries.ticketId} = ANY(${ticketIds})`,
            gte(helpdeskTimeEntries.loggedAt, periodStart),
            lt(helpdeskTimeEntries.loggedAt, periodEnd),
          )
        )
    : []

  // Compute aggregates
  const byPriority = { critical: 0, high: 0, normal: 0, low: 0 }
  const byCategory: Record<string, number> = {}
  const bySource = { email: 0, phone: 0, portal: 0, rmm: 0, internal: 0 }
  const byStatus: Record<string, number> = {}
  let proactiveTickets = 0
  let clientInitiated = 0
  let internalOnly = 0
  let slaResponseMet = 0
  let slaResponseBreached = 0
  let slaResolutionMet = 0
  let slaResolutionBreached = 0
  let totalResponseMs = 0
  let responseCount = 0
  let totalResolutionMs = 0
  let resolutionCount = 0

  for (const t of tickets) {
    // Priority
    if (t.priority in byPriority) {
      byPriority[t.priority as keyof typeof byPriority]++
    }

    // Category
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1

    // Source
    if (t.source in bySource) {
      bySource[t.source as keyof typeof bySource]++
    }

    // Status
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1

    // Proactive vs client-initiated
    if (t.isProactive) {
      proactiveTickets++
    } else if (t.isInternal) {
      internalOnly++
    } else {
      clientInitiated++
    }

    // SLA
    if (t.slaResponseDue) {
      if (t.slaResponseBreached) {
        slaResponseBreached++
      } else {
        slaResponseMet++
      }
    }
    if (t.slaResolutionDue) {
      if (t.slaResolutionBreached) {
        slaResolutionBreached++
      } else {
        slaResolutionMet++
      }
    }

    // Response time
    if (t.firstRespondedAt && t.createdAt) {
      totalResponseMs += t.firstRespondedAt.getTime() - t.createdAt.getTime()
      responseCount++
    }

    // Resolution time
    if (t.resolvedAt && t.createdAt) {
      totalResolutionMs += t.resolvedAt.getTime() - t.createdAt.getTime()
      resolutionCount++
    }
  }

  // Time entries
  let billableMinutes = 0
  let nonBillableMinutes = 0
  for (const entry of timeEntries) {
    if (entry.billable) {
      billableMinutes += entry.minutes
    } else {
      nonBillableMinutes += entry.minutes
    }
  }
  const totalMinutesLogged = billableMinutes + nonBillableMinutes
  const includedHoursUsed = Math.round((billableMinutes / 60) * 10) / 10
  const includedHoursRemaining = Math.max(0, 2 - includedHoursUsed) // 2hr/mo default

  // Top categories
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }))

  // Notable tickets (P1/P2 or tickets with AI summaries)
  const notableTickets = tickets
    .filter((t) => t.priority === 'critical' || t.priority === 'high' || t.aiSummary)
    .slice(0, 10)
    .map((t) => ({
      ticketNumber: t.ticketNumber,
      subject: t.subject,
      priority: t.priority,
      summary: t.aiSummary ?? t.subject,
    }))

  // Savings estimate (for semi-annual reports)
  const BREAK_FIX_HOURLY = 95
  const EMERGENCY_ARRIVAL = 250
  const EMERGENCY_HOURLY = 125
  let hypotheticalBreakFixCost = 0

  for (const t of tickets) {
    if (t.isProactive) {
      // Proactive catches: would have been discovered as failure
      hypotheticalBreakFixCost += EMERGENCY_ARRIVAL + 2 * BREAK_FIX_HOURLY
    } else if (t.priority === 'critical') {
      const mins = t.totalMinutes || 60
      hypotheticalBreakFixCost += EMERGENCY_ARRIVAL + Math.ceil(mins / 60) * EMERGENCY_HOURLY
    } else {
      const mins = t.totalMinutes || 30
      hypotheticalBreakFixCost += Math.ceil(mins / 60) * BREAK_FIX_HOURLY
    }
  }
  // Round to nearest $25
  hypotheticalBreakFixCost = Math.round(hypotheticalBreakFixCost / 25) * 25

  // MSP cost for period
  const monthsInPeriod = Math.round(
    (periodEnd.getTime() - periodStart.getTime()) / (30 * 24 * 60 * 60 * 1000)
  )
  const actualMspCost = (params.mspMonthlyCost ?? 295) * Math.max(1, monthsInPeriod)
  const estimatedSavings = Math.max(0, hypotheticalBreakFixCost - actualMspCost)

  return {
    client: { name: client.clientName, slaTier: client.slaTier },
    period: { start: periodStart, end: periodEnd, label: periodLabel },
    totalTickets: tickets.length,
    byPriority,
    byCategory,
    bySource,
    byStatus,
    proactiveTickets,
    clientInitiated,
    internalOnly,
    slaResponseMet,
    slaResponseBreached,
    slaResolutionMet,
    slaResolutionBreached,
    avgResponseMinutes: responseCount > 0 ? Math.round(totalResponseMs / responseCount / 60000) : 0,
    avgResolutionHours: resolutionCount > 0 ? Math.round((totalResolutionMs / resolutionCount / 3600000) * 10) / 10 : 0,
    totalMinutesLogged,
    billableMinutes,
    nonBillableMinutes,
    includedHoursUsed,
    includedHoursRemaining,
    topCategories,
    notableTickets,
    hypotheticalBreakFixCost,
    actualMspCost,
    estimatedSavings,
  }
}
