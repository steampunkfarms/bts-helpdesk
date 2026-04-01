import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskReports, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role === 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const reports = await db
    .select({
      id: helpdeskReports.id,
      clientId: helpdeskReports.clientId,
      clientName: helpdeskClients.clientName,
      reportType: helpdeskReports.reportType,
      periodStart: helpdeskReports.periodStart,
      periodEnd: helpdeskReports.periodEnd,
      periodLabel: helpdeskReports.periodLabel,
      pdfUrl: helpdeskReports.pdfUrl,
      reportData: helpdeskReports.reportData,
      status: helpdeskReports.status,
      notes: helpdeskReports.notes,
      reviewedBy: helpdeskReports.reviewedBy,
      generatedAt: helpdeskReports.generatedAt,
      sentAt: helpdeskReports.sentAt,
    })
    .from(helpdeskReports)
    .leftJoin(helpdeskClients, eq(helpdeskReports.clientId, helpdeskClients.id))
    .where(eq(helpdeskReports.id, id))
    .limit(1)

  if (!reports[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(reports[0])
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.status !== undefined) updates.status = body.status
  if (body.reviewedBy !== undefined) updates.reviewedBy = body.reviewedBy

  const [updated] = await db
    .update(helpdeskReports)
    .set(updates)
    .where(eq(helpdeskReports.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}
