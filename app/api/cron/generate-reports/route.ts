import { NextRequest } from 'next/server'
import { verifyCronAuth, cronResponse } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { helpdeskClients, helpdeskReports } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { buildReportData } from '@/lib/reports/data'
import { generateReportNarrative } from '@/lib/ai/report-writer'
import { generateAndUploadPdf } from '@/lib/reports/pdf'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — generating multiple reports with AI + PDF

type ReportType = 'monthly_summary' | 'quarterly_priority' | 'semi_annual_savings' | 'annual_review'

function getReportsToGenerate(month: number): ReportType[] {
  const types: ReportType[] = ['monthly_summary']
  if ([1, 4, 7, 10].includes(month)) types.push('quarterly_priority')
  if ([1, 7].includes(month)) types.push('semi_annual_savings')
  if (month === 1) types.push('annual_review')
  return types
}

function getBillingPeriod(reportType: ReportType, now: Date): { start: Date; end: Date; label: string } {
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed

  // Monthly: 5th of prev month to 4th of current month
  if (reportType === 'monthly_summary') {
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    const start = new Date(prevYear, prevMonth, 5)
    const end = new Date(year, month, 5)
    const label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return { start, end, label }
  }

  // Quarterly: previous 3 months
  if (reportType === 'quarterly_priority') {
    const qStart = new Date(year, month - 3, 5)
    const qEnd = new Date(year, month, 5)
    const quarter = Math.ceil((month + 1) / 3)
    return { start: qStart, end: qEnd, label: `Q${quarter === 1 ? 4 : quarter - 1} ${quarter === 1 ? year - 1 : year}` }
  }

  // Semi-annual: previous 6 months
  if (reportType === 'semi_annual_savings') {
    const sStart = new Date(year, month - 6, 5)
    const sEnd = new Date(year, month, 5)
    const half = month <= 6 ? 'H2' : 'H1'
    const halfYear = month <= 6 ? year - 1 : year
    return { start: sStart, end: sEnd, label: `${half} ${halfYear}` }
  }

  // Annual: previous 12 months
  const aStart = new Date(year - 1, month, 5)
  const aEnd = new Date(year, month, 5)
  return { start: aStart, end: aEnd, label: `${year - 1} Annual` }
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return cronResponse({ error: 'Unauthorized' }, 401)
  }

  const now = new Date()
  const month = now.getMonth() + 1 // 1-indexed
  const reportTypes = getReportsToGenerate(month)

  // Fetch all active clients
  const clients = await db
    .select()
    .from(helpdeskClients)
    .where(eq(helpdeskClients.isActive, true))

  let generated = 0
  let errors = 0

  for (const client of clients) {
    for (const reportType of reportTypes) {
      try {
        const period = getBillingPeriod(reportType, now)

        const reportData = await buildReportData({
          clientId: client.id,
          periodStart: period.start,
          periodEnd: period.end,
          periodLabel: period.label,
        })

        // Skip if no tickets in period
        if (reportData.totalTickets === 0 && reportType !== 'monthly_summary') continue

        const narrative = await generateReportNarrative(reportType, reportData)

        const pdfUrl = await generateAndUploadPdf({
          clientId: client.id,
          clientName: client.clientName,
          periodLabel: period.label,
          reportType,
          narrative,
        })

        await db.insert(helpdeskReports).values({
          clientId: client.id,
          reportType,
          periodStart: period.start,
          periodEnd: period.end,
          periodLabel: period.label,
          pdfUrl,
          reportData: reportData as unknown as Record<string, unknown>,
          status: 'draft',
        })

        generated++
      } catch (e) {
        console.error(`[generate-reports] Failed for ${client.clientName} / ${reportType}:`, e)
        errors++
      }
    }
  }

  // Notify Erick
  if (generated > 0) {
    try {
      const resend = getResendClient()
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: 'erick@tronboll.us',
        subject: `${generated} report${generated !== 1 ? 's' : ''} generated — review and approve`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <p><strong>${generated}</strong> report${generated !== 1 ? 's' : ''} generated for ${clients.length} client${clients.length !== 1 ? 's' : ''}.</p>
            ${errors > 0 ? `<p style="color:#ef4444">${errors} report${errors !== 1 ? 's' : ''} failed — check logs.</p>` : ''}
            <p>Review and approve in the <a href="https://helpdesk.tronboll.us/reports">Reports dashboard</a>.</p>
          </div>
        `,
      })
    } catch (e) {
      console.error('[generate-reports] Failed to notify admin:', e)
    }
  }

  return cronResponse({ generated, errors, clients: clients.length, reportTypes })
}
