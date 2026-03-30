import { db } from './db'
import { helpdeskTickets } from './schema'
import { like, desc } from 'drizzle-orm'

/**
 * Generate the next ticket number: BTS-YYYYMMDD-NNN
 * Queries today's max sequence number and increments.
 */
export async function generateTicketNumber(): Promise<string> {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `BTS-${dateStr}-`

  const latest = await db
    .select({ ticketNumber: helpdeskTickets.ticketNumber })
    .from(helpdeskTickets)
    .where(like(helpdeskTickets.ticketNumber, `${prefix}%`))
    .orderBy(desc(helpdeskTickets.ticketNumber))
    .limit(1)

  let seq = 1
  if (latest.length > 0) {
    const lastSeq = parseInt(latest[0].ticketNumber.split('-').pop() ?? '0', 10)
    seq = lastSeq + 1
  }

  return `${prefix}${String(seq).padStart(3, '0')}`
}
