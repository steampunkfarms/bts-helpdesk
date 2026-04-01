import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskReports, helpdeskClients } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const clientId = url.searchParams.get('clientId')

  let query = db
    .select({
      id: helpdeskReports.id,
      clientId: helpdeskReports.clientId,
      clientName: helpdeskClients.clientName,
      reportType: helpdeskReports.reportType,
      periodLabel: helpdeskReports.periodLabel,
      status: helpdeskReports.status,
      pdfUrl: helpdeskReports.pdfUrl,
      generatedAt: helpdeskReports.generatedAt,
      sentAt: helpdeskReports.sentAt,
    })
    .from(helpdeskReports)
    .leftJoin(helpdeskClients, eq(helpdeskReports.clientId, helpdeskClients.id))
    .orderBy(desc(helpdeskReports.generatedAt))
    .$dynamic()

  if (status) {
    query = query.where(eq(helpdeskReports.status, status))
  }
  if (clientId) {
    query = query.where(eq(helpdeskReports.clientId, clientId))
  }

  const reports = await query.limit(100)
  return NextResponse.json(reports)
}
