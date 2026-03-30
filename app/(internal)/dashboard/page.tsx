import { db } from '@/lib/db'
import { helpdeskTickets } from '@/lib/schema'
import { and, sql } from 'drizzle-orm'
import Link from 'next/link'

export default async function DashboardPage() {
  // Counts by status
  const statusCounts = await db
    .select({
      status: helpdeskTickets.status,
      count: sql<number>`count(*)::int`,
    })
    .from(helpdeskTickets)
    .groupBy(helpdeskTickets.status)

  const countMap: Record<string, number> = {}
  for (const row of statusCounts) {
    countMap[row.status] = row.count
  }

  // Priority counts for open tickets
  const priorityCounts = await db
    .select({
      priority: helpdeskTickets.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(helpdeskTickets)
    .where(sql`${helpdeskTickets.status} NOT IN ('resolved', 'closed')`)
    .groupBy(helpdeskTickets.priority)

  const priorityMap: Record<string, number> = {}
  for (const row of priorityCounts) {
    priorityMap[row.priority] = row.count
  }

  // SLA breaches
  const slaBreaches = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(helpdeskTickets)
    .where(
      and(
        sql`${helpdeskTickets.status} NOT IN ('resolved', 'closed')`,
        sql`(${helpdeskTickets.slaResponseBreached} = true OR ${helpdeskTickets.slaResolutionBreached} = true)`
      )
    )

  const breachCount = slaBreaches[0]?.count ?? 0

  // Recent tickets
  const recent = await db
    .select({
      id: helpdeskTickets.id,
      ticketNumber: helpdeskTickets.ticketNumber,
      subject: helpdeskTickets.subject,
      priority: helpdeskTickets.priority,
      status: helpdeskTickets.status,
      source: helpdeskTickets.source,
      createdAt: helpdeskTickets.createdAt,
    })
    .from(helpdeskTickets)
    .orderBy(sql`${helpdeskTickets.createdAt} DESC`)
    .limit(10)

  const openCount = Object.entries(countMap)
    .filter(([s]) => !['resolved', 'closed'].includes(s))
    .reduce((sum, [, c]) => sum + c, 0)

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Dashboard</h2>

      {/* Stats cards — clickable */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Open Tickets" value={openCount} href="/tickets?status=open" />
        <StatCard label="Critical" value={priorityMap['critical'] ?? 0} color="text-red-400" href="/tickets?priority=critical" />
        <StatCard label="High" value={priorityMap['high'] ?? 0} color="text-orange-400" href="/tickets?priority=high" />
        <StatCard label="SLA Breaches" value={breachCount} color={breachCount > 0 ? 'text-red-400' : undefined} href="/tickets" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/tickets/new"
          className="px-4 py-2 bg-orange-700 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
        >
          + New Ticket
        </Link>
        <Link
          href="/tickets"
          className="px-4 py-2 border border-gray-700 hover:border-gray-500 text-gray-300 rounded-lg text-sm"
        >
          View All Tickets
        </Link>
      </div>

      {/* Recent activity */}
      <h3 className="text-lg font-semibold mb-3">Recent Tickets</h3>
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left px-4 py-3 font-medium">Ticket</th>
              <th className="text-left px-4 py-3 font-medium">Subject</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No tickets yet. Create one or wait for email/phone intake.
                </td>
              </tr>
            ) : (
              recent.map((t) => (
                <tr key={t.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${t.id}`} className="text-orange-400 hover:underline font-mono text-xs">
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{t.subject}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{t.source}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, href }: { label: string; value: number; color?: string; href: string }) {
  return (
    <Link href={href} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
    </Link>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-900/50 text-red-300 border-red-700',
    high: 'bg-orange-900/50 text-orange-300 border-orange-700',
    normal: 'bg-gray-800 text-gray-300 border-gray-700',
    low: 'bg-gray-800 text-gray-500 border-gray-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${colors[priority] ?? colors.normal}`}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-900/50 text-blue-300',
    in_progress: 'bg-yellow-900/50 text-yellow-300',
    awaiting_client: 'bg-purple-900/50 text-purple-300',
    awaiting_tech: 'bg-cyan-900/50 text-cyan-300',
    resolved: 'bg-green-900/50 text-green-300',
    closed: 'bg-gray-800 text-gray-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded ${colors[status] ?? colors.open}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
