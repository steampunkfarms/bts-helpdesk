import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { helpdeskTickets, helpdeskReports, helpdeskClients } from '@/lib/schema'
import { eq, and, desc, notInArray } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import Link from 'next/link'

export default async function PortalDashboard() {
  const session = await getSession()
  if (!session || session.role !== 'client' || !session.clientId) redirect('/portal/login')

  const clientId = session.clientId

  // Client name
  const clients = await db
    .select({ clientName: helpdeskClients.clientName })
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, clientId))
    .limit(1)
  const clientName = clients[0]?.clientName ?? 'Your Organization'

  // Open ticket count
  const openCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.clientId, clientId),
        eq(helpdeskTickets.isInternal, false),
        notInArray(helpdeskTickets.status, ['resolved', 'closed']),
      )
    )

  // Recent tickets (safe columns only)
  const recentTickets = await db
    .select({
      id: helpdeskTickets.id,
      ticketNumber: helpdeskTickets.ticketNumber,
      subject: helpdeskTickets.subject,
      status: helpdeskTickets.status,
      priority: helpdeskTickets.priority,
      createdAt: helpdeskTickets.createdAt,
    })
    .from(helpdeskTickets)
    .where(
      and(
        eq(helpdeskTickets.clientId, clientId),
        eq(helpdeskTickets.isInternal, false),
      )
    )
    .orderBy(desc(helpdeskTickets.createdAt))
    .limit(5)

  // Latest report
  const latestReport = await db
    .select({
      id: helpdeskReports.id,
      reportType: helpdeskReports.reportType,
      periodLabel: helpdeskReports.periodLabel,
      pdfUrl: helpdeskReports.pdfUrl,
      sentAt: helpdeskReports.sentAt,
    })
    .from(helpdeskReports)
    .where(
      and(
        eq(helpdeskReports.clientId, clientId),
        eq(helpdeskReports.status, 'sent'),
      )
    )
    .orderBy(desc(helpdeskReports.sentAt))
    .limit(1)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{clientName}</h1>
      <p className="text-sm text-gray-500 mb-8">IT Support Portal</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Active Tickets */}
        <Link
          href="/portal/tickets"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-orange-300 transition-colors"
        >
          <p className="text-sm text-gray-500 mb-1">Active Tickets</p>
          <p className="text-3xl font-bold text-gray-900">{openCount[0]?.count ?? 0}</p>
        </Link>

        {/* New Request */}
        <Link
          href="/portal/tickets/new"
          className="bg-orange-700 text-white rounded-xl p-5 hover:bg-orange-600 transition-colors flex flex-col justify-center"
        >
          <p className="text-sm opacity-80 mb-1">Need help?</p>
          <p className="text-lg font-bold">Submit New Request</p>
        </Link>

        {/* Latest Report */}
        {latestReport[0] ? (
          <a
            href={latestReport[0].pdfUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-orange-300 transition-colors"
          >
            <p className="text-sm text-gray-500 mb-1">Latest Report</p>
            <p className="text-lg font-bold text-gray-900">{latestReport[0].periodLabel}</p>
            <p className="text-xs text-gray-400 mt-1">Click to download PDF</p>
          </a>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-sm text-gray-500 mb-1">Latest Report</p>
            <p className="text-sm text-gray-400">No reports yet</p>
          </div>
        )}
      </div>

      {/* Recent Tickets */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Tickets</h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {recentTickets.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">No tickets yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="text-left px-5 py-3 font-medium">Ticket</th>
                <th className="text-left px-5 py-3 font-medium">Subject</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/portal/tickets/${t.id}`} className="text-orange-700 hover:underline font-mono text-xs">
                      {t.ticketNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-900">{t.subject}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contact */}
      <div className="mt-8 bg-gray-100 rounded-xl p-5 text-sm text-gray-600">
        <p className="font-medium text-gray-900 mb-1">Need immediate help?</p>
        <p>Email <a href="mailto:helpdesk@tronboll.us" className="text-orange-700 hover:underline">helpdesk@tronboll.us</a> or call <strong>(760) 782-8476</strong></p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    in_progress: 'bg-yellow-50 text-yellow-700',
    awaiting_client: 'bg-purple-50 text-purple-700',
    awaiting_tech: 'bg-cyan-50 text-cyan-700',
    resolved: 'bg-green-50 text-green-700',
    closed: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${colors[status] ?? colors.open}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
