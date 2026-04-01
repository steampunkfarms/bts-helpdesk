import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskReports } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireClient } from '@/lib/auth'

// SAFE columns — no reportData (internal metrics), no reviewedBy, no notes
const SAFE_REPORT_COLUMNS = {
  id: helpdeskReports.id,
  reportType: helpdeskReports.reportType,
  periodLabel: helpdeskReports.periodLabel,
  pdfUrl: helpdeskReports.pdfUrl,
  sentAt: helpdeskReports.sentAt,
} as const

export async function GET() {
  const session = await requireClient()

  // Only sent reports — drafts are internal
  const reports = await db
    .select(SAFE_REPORT_COLUMNS)
    .from(helpdeskReports)
    .where(
      and(
        eq(helpdeskReports.clientId, session.clientId),
        eq(helpdeskReports.status, 'sent'),
      )
    )
    .orderBy(desc(helpdeskReports.sentAt))
    .limit(50)

  return NextResponse.json(reports)
}
