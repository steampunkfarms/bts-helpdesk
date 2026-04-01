import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskReports } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { buildReportData } from '@/lib/reports/data'
import { generateReportNarrative } from '@/lib/ai/report-writer'
import { generateAndUploadPdf } from '@/lib/reports/pdf'
import { auditLog } from '@/lib/audit'

export const maxDuration = 120

type ReportType = 'monthly_summary' | 'quarterly_priority' | 'semi_annual_savings' | 'annual_review'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const reports = await db
    .select()
    .from(helpdeskReports)
    .where(eq(helpdeskReports.id, id))
    .limit(1)

  const report = reports[0]
  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Re-query data and regenerate
  const reportData = await buildReportData({
    clientId: report.clientId,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    periodLabel: report.periodLabel,
  })

  const narrative = await generateReportNarrative(
    report.reportType as ReportType,
    reportData,
  )

  // Fetch client name from existing report data or DB
  const existingData = report.reportData as Record<string, unknown> | null
  const clientName = (existingData?.client as Record<string, string>)?.name ?? report.periodLabel

  const pdfUrl = await generateAndUploadPdf({
    clientId: report.clientId,
    clientName,
    periodLabel: report.periodLabel,
    reportType: report.reportType,
    narrative,
  })

  await db
    .update(helpdeskReports)
    .set({
      reportData: reportData as unknown as Record<string, unknown>,
      pdfUrl,
      generatedAt: new Date(),
      status: 'draft',
    })
    .where(eq(helpdeskReports.id, id))

  await auditLog({
    entityType: 'report',
    entityId: id,
    action: 'report_regenerated',
    userId: session.email,
  })

  return NextResponse.json({ ok: true, pdfUrl })
}
