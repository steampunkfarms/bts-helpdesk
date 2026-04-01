import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { helpdeskReports, helpdeskClients } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { getResendClient, FROM_ADDRESS } from '@/lib/resend'
import { auditLog } from '@/lib/audit'

const REPORT_TYPE_LABELS: Record<string, string> = {
  monthly_summary: 'Monthly Service Summary',
  quarterly_priority: 'Quarterly Priority Report',
  semi_annual_savings: 'Semi-Annual Savings Analysis',
  annual_review: 'Annual Review',
}

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

  if (!report.pdfUrl) {
    return NextResponse.json({ error: 'No PDF generated yet' }, { status: 400 })
  }

  // Fetch client
  const clients = await db
    .select()
    .from(helpdeskClients)
    .where(eq(helpdeskClients.id, report.clientId))
    .limit(1)

  const client = clients[0]
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Download PDF for attachment
  const pdfResponse = await fetch(report.pdfUrl)
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

  const typeLabel = REPORT_TYPE_LABELS[report.reportType] ?? report.reportType

  // Send email
  const resend = getResendClient()
  const result = await resend.emails.send({
    from: FROM_ADDRESS,
    to: client.primaryEmail,
    subject: `BTS IT Management Report — ${report.periodLabel}`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <p>Hi ${client.clientName.split(/\s/)[0]},</p>
        <p>Please find attached your <strong>${typeLabel}</strong> for <strong>${report.periodLabel}</strong>.</p>
        <p>This report is also available in your <a href="https://helpdesk.tronboll.us/portal/reports">client portal</a>.</p>
        <p>If you have any questions about this report, just reply to this email or call us at (760) 782-8476.</p>
        <p style="margin-top:24px;color:#6b7280;font-size:0.875rem">— Backcountry Tech Solutions</p>
      </div>
    `,
    attachments: [
      {
        filename: `BTS-${report.reportType}-${report.periodLabel.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer,
      },
    ],
  })

  if (result.error) {
    return NextResponse.json({ error: 'Email send failed', detail: result.error }, { status: 502 })
  }

  // Update report status
  await db
    .update(helpdeskReports)
    .set({
      status: 'sent',
      sentAt: new Date(),
      reviewedBy: session.email,
    })
    .where(eq(helpdeskReports.id, id))

  await auditLog({
    entityType: 'report',
    entityId: id,
    action: 'report_sent',
    userId: session.email,
    afterData: { clientEmail: client.primaryEmail, reportType: report.reportType },
  })

  return NextResponse.json({ ok: true, sentTo: client.primaryEmail })
}
